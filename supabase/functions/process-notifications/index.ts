// Edge Function: process-notifications
// Worker générique qui dépile `notification_log` (status='pending') et
// envoie l'e-mail correspondant via Brevo (FR) ou Resend (fallback US).
//
// Idempotent : marque chaque ligne `sent` ou `failed` (avec error) après
// tentative. Peut être appelé par cron (toutes les 5 minutes) OU à la
// demande depuis l'app (après UPDATE annulation, fermeture météo, etc.).
//
// Templates gérés :
//   - reminder_j1, reminder_h1 : rappels avant créneau
//   - closure                  : fermeture météo
//   - waitlist_offered         : place libérée
//   - satisfaction             : enquête post-visite
//
// Le template `confirmation` reste géré par send-confirmation-email
// (parce qu'il a un QR code en pièce jointe).
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

function esc(v: unknown): string {
  return String(v ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function fmtDate(iso: string): string {
  // 2026-07-15 → 15 juillet 2026
  const d = new Date(iso + 'T00:00:00');
  const months = ['janvier','février','mars','avril','mai','juin','juillet','août','septembre','octobre','novembre','décembre'];
  return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
}

function fmtTime(t: string): string {
  // 14:00:00 → 14h00
  const [h, m] = t.split(':');
  return `${h}h${m}`;
}

const BATCH_SIZE = 50;
const MAX_DURATION_MS = 25_000; // marge sous le timeout 30s Edge Function

serve(async (req: Request) => {
  // --- Authentification cron (durcissement v1.4.0) ---
  // Endpoint anciennement public → vecteur DOS (vide la quota Brevo,
  // déclenche les rappels avant l'heure). On exige soit :
  //  - Authorization: Bearer <CRON_SECRET> (cron pg_cron / GitHub Actions)
  //  - Authorization: Bearer <SUPABASE_SERVICE_ROLE_KEY> (admin / debug)
  const CRON_SECRET = Deno.env.get('CRON_SECRET') ?? '';
  const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const auth = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '').trim();
  const authorized =
    (CRON_SECRET && auth === CRON_SECRET) ||
    (SERVICE_ROLE && auth === SERVICE_ROLE);
  if (!authorized) {
    return new Response(JSON.stringify({ error: 'unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );
  const brevoKey = Deno.env.get('BREVO_API_KEY');
  const resendKey = Deno.env.get('RESEND_API_KEY');
  const appUrl = Deno.env.get('APP_URL') ?? 'https://baignade.lesrivesdeparis.fr';
  const fromEmail = Deno.env.get('FROM_EMAIL') ?? 'baignade@lesrivesdeparis.fr';
  const fromName = Deno.env.get('FROM_NAME') ?? "Baignade Rives d'Paris";

  if (!brevoKey && !resendKey) {
    return new Response(JSON.stringify({ error: 'no_email_provider' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Dépile par lots ; les confirmations restent gérées par leur fonction dédiée.
  const { data: pending, error: fetchErr } = await supabase
    .from('notification_log')
    .select('id, reservation_id, user_id, template, channel')
    .eq('status', 'pending')
    .eq('channel', 'email')
    .neq('template', 'confirmation')
    .order('created_at', { ascending: true })
    .limit(BATCH_SIZE);

  if (fetchErr) {
    return new Response(JSON.stringify({ error: fetchErr.message }), { status: 500 });
  }
  if (!pending || pending.length === 0) {
    return new Response(JSON.stringify({ processed: 0 }), {
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const started = Date.now();
  let sent = 0; let failed = 0;

  for (const job of pending) {
    if (Date.now() - started > MAX_DURATION_MS) break;

    try {
      // Profil destinataire
      const { data: user } = await supabase
        .from('profiles')
        .select('email, first_name, last_name')
        .eq('id', job.user_id)
        .maybeSingle();
      if (!user?.email) {
        await markFailed(supabase, job.id, 'no_email');
        failed++; continue;
      }

      // Réservation + créneau (peuvent être null pour waitlist_offered)
      let reservation: any = null;
      let slot: any = null;
      if (job.reservation_id) {
        const { data } = await supabase
          .from('reservations')
          .select('reference, nb_adults, nb_children, total_amount_cents, slot:slots(date, start_time, end_time)')
          .eq('id', job.reservation_id).maybeSingle();
        reservation = data;
        slot = data?.slot ?? null;
      } else if (job.template === 'waitlist_offered') {
        // Le slot vient de la dernière entrée waitlist non finalisée
        const { data: wl } = await supabase
          .from('waitlist')
          .select('nb_persons, slot:slots(date, start_time, end_time)')
          .eq('user_id', job.user_id)
          .eq('status', 'offered')
          .order('notified_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        slot = wl?.slot ?? null;
      }

      // Template (éditable en back-office)
      const { data: tpl } = await supabase
        .from('email_templates')
        .select('subject, body_html')
        .eq('key', job.template)
        .maybeSingle();
      if (!tpl) { await markFailed(supabase, job.id, 'template_missing'); failed++; continue; }

      const vars: Record<string,string> = {
        prenom: esc(user.first_name),
        nom: esc(user.last_name),
        reference: esc(reservation?.reference ?? ''),
        date: slot ? fmtDate(slot.date) : '',
        horaire: slot ? `${fmtTime(slot.start_time)} – ${fmtTime(slot.end_time)}` : '',
        nb_personnes: reservation
          ? `${reservation.nb_adults} adulte(s)${reservation.nb_children > 0 ? ` + ${reservation.nb_children} enfant(s)` : ''}`
          : '',
        total: reservation ? `${(reservation.total_amount_cents / 100).toFixed(2)} €` : '',
        lieu: 'Chemin de la Haute-Île, 93330 Neuilly-sur-Marne (à 20 min à pied du RER A)',
        lien_compte: `${appUrl}/compte`,
      };
      const subst = (s: string) => s.replace(/\{\{\s*(\w+)\s*\}\}/g, (_m, k) => vars[k] ?? '');
      const subject = subst(tpl.subject);
      const bodyContent = subst(tpl.body_html);

      // Gabarit sûr (identique à send-confirmation-email moins le QR)
      const html = `
<!DOCTYPE html>
<html lang="fr"><body style="font-family:Inter,Arial,sans-serif;background:#f1f5f9;margin:0;padding:24px;color:#0f172a">
<div style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 12px rgba(2,132,199,.1)">
  <div style="background:linear-gradient(135deg,#0284c7,#0c4a6e);color:#fff;padding:28px 32px">
    <h1 style="margin:0;font-size:22px;color:#F5C111">Baignade Rives d'Paris</h1>
    <p style="margin:6px 0 0;opacity:.9;font-size:14px">Neuilly-sur-Marne</p>
  </div>
  <div style="padding:28px 32px;font-size:14px;line-height:1.55">${bodyContent}</div>
  <div style="background:#f8fafc;padding:18px 32px;font-size:12px;color:#64748b;text-align:center">
    Commune de Neuilly-sur-Marne · <a href="${appUrl}/compte" style="color:#0284c7">Mon espace</a>
  </div>
</div>
</body></html>`;

      const ok = await sendEmail({
        brevoKey, resendKey, fromName, fromEmail,
        toEmail: user.email,
        toName: `${user.first_name ?? ''} ${user.last_name ?? ''}`.trim(),
        subject, html,
      });

      if (ok) {
        await supabase.from('notification_log').update({
          status: 'sent', sent_at: new Date().toISOString(), error: null,
        }).eq('id', job.id);
        sent++;
      } else {
        await markFailed(supabase, job.id, 'provider_error');
        failed++;
      }
    } catch (e: any) {
      await markFailed(supabase, job.id, e.message ?? 'unknown');
      failed++;
    }
  }

  return new Response(JSON.stringify({ processed: sent + failed, sent, failed }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

async function markFailed(supabase: any, id: string, msg: string) {
  await supabase.from('notification_log').update({
    status: 'failed', error: msg,
  }).eq('id', id);
}

async function sendEmail(opts: {
  brevoKey?: string; resendKey?: string;
  fromName: string; fromEmail: string;
  toEmail: string; toName: string;
  subject: string; html: string;
}): Promise<boolean> {
  try {
    if (opts.brevoKey) {
      const res = await fetch('https://api.brevo.com/v3/smtp/email', {
        method: 'POST',
        headers: { 'api-key': opts.brevoKey, 'Content-Type': 'application/json', accept: 'application/json' },
        body: JSON.stringify({
          sender: { name: opts.fromName, email: opts.fromEmail },
          to: [{ email: opts.toEmail, name: opts.toName }],
          subject: opts.subject, htmlContent: opts.html,
        }),
      });
      return res.ok;
    }
    if (opts.resendKey) {
      const res = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: { Authorization: `Bearer ${opts.resendKey}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          from: `${opts.fromName} <${opts.fromEmail}>`,
          to: opts.toEmail, subject: opts.subject, html: opts.html,
        }),
      });
      return res.ok;
    }
    return false;
  } catch {
    return false;
  }
}
