// Edge Function: scan-qr
// Vérifie un QR code, marque la réservation comme utilisée, journalise le scan.
// Sécurisé : seuls les utilisateurs avec rôle staff/admin peuvent appeler.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  const { qr_token, scanned_by } = await req.json();
  if (!qr_token) return json({ result: 'invalid', message: 'Token manquant' }, 400);

  // Vérifier que le scanner est staff/admin
  if (scanned_by) {
    const { data: scanner } = await supabase.from('profiles').select('role').eq('id', scanned_by).single();
    if (!scanner || !['admin', 'manager', 'staff'].includes(scanner.role)) {
      return json({ result: 'invalid', message: 'Non autorisé' }, 403);
    }
  }

  const { data: reservation } = await supabase
    .from('reservations')
    .select('*, slot:slots(*), user:profiles(first_name, last_name)')
    .eq('qr_code_token', qr_token)
    .maybeSingle();

  if (!reservation) {
    await supabase.from('scan_log').insert({ result: 'invalid', scanned_by, notes: `Token: ${qr_token}` });
    return json({ result: 'invalid', message: 'QR code non reconnu' });
  }

  // Génère une URL signée pour le justificatif si présent (valable 5 min)
  let proofSignedUrl: string | null = null;
  if (reservation.resident_proof_url) {
    const { data: signed } = await supabase.storage
      .from('resident-proofs')
      .createSignedUrl(reservation.resident_proof_url, 60 * 5);
    proofSignedUrl = signed?.signedUrl ?? null;
  }

  if (reservation.status === 'used' || reservation.qr_used_at) {
    await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'already_used', scanned_by });
    return json({
      result: 'already_used',
      message: `Déjà scanné le ${new Date(reservation.qr_used_at).toLocaleString('fr-FR')}`,
      reservation: formatReservation(reservation, proofSignedUrl),
    });
  }

  if (['cancelled', 'refunded', 'expired'].includes(reservation.status)) {
    await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'invalid', scanned_by });
    return json({ result: 'invalid', message: `Statut : ${reservation.status}` });
  }

  // Vérifie que c'est aujourd'hui (tolérance ±2h)
  const today = new Date().toISOString().slice(0, 10);
  if (reservation.slot.date !== today) {
    await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'wrong_slot', scanned_by });
    return json({ result: 'wrong_slot', message: `Créneau prévu le ${reservation.slot.date}`, reservation: formatReservation(reservation, proofSignedUrl) });
  }

  // Marquer comme utilisée
  await supabase
    .from('reservations')
    .update({ status: 'used', qr_used_at: new Date().toISOString(), scanned_by })
    .eq('id', reservation.id);
  await supabase.from('scan_log').insert({ reservation_id: reservation.id, result: 'valid', scanned_by });

  return json({ result: 'valid', message: 'Bienvenue !', reservation: formatReservation(reservation, proofSignedUrl) });
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
