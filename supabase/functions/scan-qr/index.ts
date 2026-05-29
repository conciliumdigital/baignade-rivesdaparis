// Edge Function: scan-qr
// Vérifie un QR code, marque la réservation comme utilisée, journalise le scan.
// SÉCURITÉ : l'identité ET le rôle de l'agent sont dérivés du JWT du caller,
// jamais du corps de la requête. Échec fermé (fail-closed) si non authentifié
// ou rôle insuffisant. L'URL signée du justificatif (PII) n'est générée
// qu'après autorisation et uniquement pour un accès valide.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Libellés français pour les statuts visibles par l'agent d'accueil
const STATUS_FR: Record<string, string> = {
  pending_payment: 'paiement en attente',
  confirmed: 'confirmée',
  cancelled: 'annulée',
  refunded: 'remboursée',
  used: 'utilisée',
  no_show: 'non présentée',
  expired: 'expirée',
};
function fmtStatus(s: string | null | undefined): string {
  return s ? (STATUS_FR[s] ?? s) : 'inconnue';
}
function fmtDate(iso: string): string {
  // 2026-07-15 → 15/07/2026
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y}`;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
  const SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY')!;

  // --- Authentification : identité dérivée du JWT (jamais du body) ---
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader.startsWith('Bearer ')) {
    return json({ result: 'invalid', message: 'Authentification requise' }, 401);
  }
  const authClient = createClient(SUPABASE_URL, ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: { user }, error: authErr } = await authClient.auth.getUser();
  if (authErr || !user) {
    return json({ result: 'invalid', message: 'Session invalide' }, 401);
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  // Le scanner DOIT être staff/admin/manager : vérifié sur l'identité du JWT,
  // pas sur une valeur fournie par l'appelant.
  const { data: scanner } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single();
  if (!scanner || !['admin', 'manager', 'staff'].includes(scanner.role)) {
    return json({ result: 'invalid', message: 'Non autorisé' }, 403);
  }
  const actorId = user.id;

  const { qr_token } = await req.json().catch(() => ({ qr_token: null }));
  if (!qr_token) return json({ result: 'invalid', message: 'Token manquant' }, 400);

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, slot:slots(*), user:profiles(first_name, last_name)')
    .eq('qr_code_token', qr_token)
    .maybeSingle();

  if (!reservation) {
    // Token loggé après troncature + filtrage pour neutraliser une éventuelle log-injection
    const safeToken = String(qr_token).slice(0, 64).replace(/[^A-Za-z0-9_-]/g, '');
    await supabase.from('scan_log').insert({ result: 'invalid', scanned_by: actorId, notes: `Token: ${safeToken}` });
    return json({ result: 'invalid', message: 'QR code non reconnu.' });
  }

  if (reservation.status === 'used' || reservation.qr_used_at) {
    await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'already_used', scanned_by: actorId });
    return json({
      result: 'already_used',
      message: `Déjà scanné le ${new Date(reservation.qr_used_at).toLocaleString('fr-FR')}.`,
      reservation: formatReservation(reservation, null),
    });
  }

  if (['cancelled', 'refunded', 'expired'].includes(reservation.status)) {
    await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'invalid', scanned_by: actorId });
    return json({ result: 'invalid', message: `Réservation non valable (statut : ${fmtStatus(reservation.status)}).` });
  }

  // Vérifie que c'est aujourd'hui
  const today = new Date().toISOString().slice(0, 10);
  if (reservation.slot.date !== today) {
    await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'wrong_slot', scanned_by: actorId });
    return json({ result: 'wrong_slot', message: `Créneau prévu le ${fmtDate(reservation.slot.date)}.`, reservation: formatReservation(reservation, null) });
  }

  // Marquer comme utilisée
  await supabase
    .from('reservations')
    .update({ status: 'used', qr_used_at: new Date().toISOString(), scanned_by: actorId })
    .eq('id', reservation.id);
  await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'valid', scanned_by: actorId });

  // URL signée du justificatif : UNIQUEMENT après autorisation et pour un
  // accès valide (minimisation de l'exposition de PII).
  let proofSignedUrl: string | null = null;
  if (reservation.resident_proof_url) {
    const { data: signed } = await supabase.storage
      .from('resident-proofs')
      .createSignedUrl(reservation.resident_proof_url, 60 * 5);
    proofSignedUrl = signed?.signedUrl ?? null;
  }

  const greeting = reservation.user?.first_name
    ? `Bienvenue, ${String(reservation.user.first_name).slice(0, 40)}.`
    : 'Bienvenue.';
  return json({ result: 'valid', message: greeting, reservation: formatReservation(reservation, proofSignedUrl) });
});

function formatReservation(r: any, proofSignedUrl: string | null = null) {
  return {
    reference: r.reference,
    nb_persons: r.nb_adults + r.nb_children,
    nb_adults: r.nb_adults,
    nb_children: r.nb_children,
    date: r.slot.date,
    start_time: r.slot.start_time,
    end_time: r.slot.end_time,
    user_name: `${r.user?.first_name ?? ''} ${r.user?.last_name ?? ''}`.trim() || 'Usager',
    usager_type: r.usager_type ?? 'exterieur',
    honor_certification: !!r.honor_certification,
    proof_url: proofSignedUrl,
  };
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
