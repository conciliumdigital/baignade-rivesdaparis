// Edge Function: send-confirmation-email
// E-mail transactionnel de confirmation. Le CONTENU (objet + corps) est
// éditable depuis le back-office (table email_templates) ; le GABARIT
// (en-tête, QR, pied, structure responsive) est contrôlé ici et non
// cassable. Compatible Brevo (FR, RGPD) OU Resend (auto via env).
// Déclenché par stripe-webhook après checkout.session.completed.
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';
import QRCode from 'https://esm.sh/qrcode@1.5.4';

// Échappe les valeurs (certaines viennent du profil usager) pour éviter
// toute injection HTML dans l'e-mail.
function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

const DEFAULT_SUBJECT = 'Votre réservation est confirmée — {{date}}';
const DEFAULT_BODY =
  '<p>Bonjour {{prenom}},</p>' +
  '<p>Votre réservation est confirmée. Présentez le QR code ci-dessous à l\'accueil le jour de votre visite.</p>' +
  '<p><strong>Date :</strong> {{date}}<br><strong>Horaire :</strong> {{horaire}}<br><strong>Personnes :</strong> {{nb_personnes}}<br><strong>Total payé :</strong> {{total}}</p>' +
  '<p><strong>Lieu :</strong> {{lieu}}</p>' +
  '<p>À apporter : maillot de bain, serviette, crème solaire. Casiers gratuits sur place.</p>' +
  '<p><a href="{{lien_compte}}">Voir ma réservation</a></p>';

serve(async (req: Request) => {
  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');

  const { reservation_id } = await req.json();
  const { data: r } = await supabase
    .from('reservations')
    .select('*, slot:slots(*), user:profiles(email, first_name, last_name)')
    .eq('id', reservation_id)
    .single();
  if (!r) return new Response('not found', { status: 404 });

  const qrPng = await QRCode.toBuffer(r.qr_code_token, { width: 320, margin: 2 });
  const qrBase64 = btoa(String.fromCharCode(...new Uint8Array(qrPng)));
  const appUrl = Deno.env.get('APP_URL') ?? 'https://baignade.lesrivesdeparis.fr';
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'baignade@lesrivesdeparis.fr';
  const fromName = Deno.env.get('FROM_NAME') ?? "Baignade Rives d'Paris";

  // Modèle éditable depuis le back-office (fallback = défaut codé)
  const { data: tpl } = await supabase
    .from('email_templates')
    .select('subject, body_html')
    .eq('key', 'confirmation')
    .maybeSingle();

  const vars: Record<string, string> = {
    prenom: esc(r.user?.first_name),
    nom: esc(r.user?.last_name),
    reference: esc(r.reference),
    date: esc(r.slot.date),
    horaire: esc(`${r.slot.start_time.slice(0, 5)} – ${r.slot.end_time.slice(0, 5)}`),
    nb_personnes: esc(`${r.nb_adults} adulte(s)${r.nb_children > 0 ? ` + ${r.nb_children} enfant(s)` : ''}`),
    total: esc(`${(r.total_amount_cents / 100).toFixed(2)} €`),
    lieu: 'Berge de la Marne, Neuilly-sur-Marne',
    lien_compte: `${appUrl}/compte`,
  };
  const subst = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? '');

  const subject = subst(tpl?.subject || DEFAULT_SUBJECT);
  const bodyContent = subst(tpl?.body_html || DEFAULT_BODY);

  // --- Gabarit sûr (non éditable) : en-tête + contenu + QR + pied ---
  const html = `
<!DOCTYPE html>
<html lang="fr">
<body style="font-family:Inter,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a">
  <div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(2,132,199,.1)">
    <div style="background:linear-gradient(135deg,#0284c7,#0c4a6e);color:#fff;padding:28px 32px">
      <h1 style="margin:0;font-size:22px">Réservation confirmée</h1>
      <p style="margin:6px 0 0;opacity:.9;font-size:14px">Baignade Rives d'Paris — Neuilly-sur-Marne</p>
    </div>
    <div style="padding:28px 32px;font-size:14px;line-height:1.55">
      ${bodyContent}
      <div style="text-align:center;margin:24px 0">
        <img src="data:image/png;base64,${qrBase64}" alt="QR code de votre réservation" width="240" height="240" style="width:240px;height:240px;background:#fff;border-radius:12px;border:1px solid #e2e8f0;padding:8px" />
        <div style="font-family:monospace;font-size:14px;margin-top:8px;color:#64748b">Réf. ${vars.reference}</div>
        <div style="font-size:12px;margin-top:6px;color:#94a3b8">QR code également en pièce jointe de cet e-mail.</div>
      </div>
    </div>
    <div style="background:#f8fafc;padding:18px 32px;font-size:12px;color:#64748b;text-align:center">
      Annulation gratuite jusqu'à 24h avant le créneau · Commune de Neuilly-sur-Marne
    </div>
  </div>
</body>
</html>
  `;

  let ok = false;
  let errorDetail: string | null = null;

  try {
    if (brevoKey) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': brevoKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: fromName, email: fromEmail },
          to: [{ email: r.user?.email, name: `${r.user?.first_name ?? ''} ${r.user?.last_name ?? ''}`.trim() }],
          subject,
          htmlContent: html,
          attachment: [{ name: `qrcode-${r.reference}.png`, content: qrBase64 }],
        }),
      });
      ok = res.ok;
      if (!ok) errorDetail = await res.text();
    } else if (resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${fromName} <${fromEmail}>`,
          to: r.user?.email,
          subject,
          html,
          attachments: [{ filename: `qrcode-${r.reference}.png`, content: qrBase64, content_id: 'qrcode' }],
        }),
      });
      ok = res.ok;
      if (!ok) errorDetail = await res.text();
    } else {
      errorDetail = 'Aucune clé API email configurée (BREVO_API_KEY ou RESEND_API_KEY).';
      console.warn(errorDetail);
    }
  } catch (e: any) {
    errorDetail = e.message ?? 'Erreur inconnue';
  }

  await supabase.from('notification_log').insert({
    reservation_id, user_id: r.user_id, channel: 'email', template: 'confirmation',
    status: ok ? 'sent' : 'failed', sent_at: ok ? new Date().toISOString() : null,
    error: errorDetail,
  });

  return new Response(JSON.stringify({ sent: ok, error: errorDetail }), {
    headers: { 'Content-Type': 'application/json' },
  });
});
