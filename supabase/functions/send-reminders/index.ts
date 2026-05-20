// Edge Function: send-reminders
// Cron quotidien (J-1) + horaire (H-1) — scanne les réservations
// CONFIRMÉES dont le créneau démarre dans la fenêtre cible et insère
// une ligne dans `notification_log` (template reminder_j1 ou reminder_h1)
// si pas déjà envoyée. L'envoi effectif est fait par process-notifications.
//
// Idempotence : on filtre les réservations qui ont déjà une notif
// `sent` du même template — un rejeu ne double pas les e-mails.
//
// Fenêtres (UTC) :
//   J-1 : créneau ∈ [now+23h, now+25h]   → planifier 1×/jour à 18h CET
//   H-1 : créneau ∈ [now+45min, now+75min] → planifier toutes les 30 min
//
// Body optionnel : { mode: 'j1' | 'h1' | 'both' } (défaut 'both')
// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.208.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.4';

type Mode = 'j1' | 'h1' | 'both';

serve(async (req: Request) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  );

  let mode: Mode = 'both';
  try {
    const body = await req.json();
    if (body?.mode === 'j1' || body?.mode === 'h1') mode = body.mode;
  } catch { /* pas de body = both */ }

  const now = new Date();
  const result = { j1: 0, h1: 0 };

  if (mode === 'j1' || mode === 'both') {
    result.j1 = await enqueue(supabase, 'reminder_j1', addHours(now, 23), addHours(now, 25));
  }
  if (mode === 'h1' || mode === 'both') {
    result.h1 = await enqueue(supabase, 'reminder_h1', addMinutes(now, 45), addMinutes(now, 75));
  }

  return new Response(JSON.stringify({ ok: true, ...result }), {
    headers: { 'Content-Type': 'application/json' },
  });
});

function addHours(d: Date, h: number): Date {
  return new Date(d.getTime() + h * 3600_000);
}
function addMinutes(d: Date, m: number): Date {
  return new Date(d.getTime() + m * 60_000);
}

async function enqueue(
  supabase: any, template: 'reminder_j1' | 'reminder_h1',
  startMin: Date, startMax: Date,
): Promise<number> {
  // Récupère réservations confirmées dont (slot.date + slot.start_time)
  // tombe dans la fenêtre.
  // → On élargit côté DB (slot.date ∈ [min.date, max.date]) puis on filtre
  //   précisément en JS sur le timestamp combiné.
  const dMin = startMin.toISOString().slice(0, 10);
  const dMax = startMax.toISOString().slice(0, 10);

  const { data: rows, error } = await supabase
    .from('reservations')
    .select('id, user_id, slot:slots!inner(date, start_time, status)')
    .eq('status', 'confirmed')
    .gte('slot.date', dMin).lte('slot.date', dMax);
  if (error || !rows) return 0;

  const candidates = rows.filter((r: any) => {
    if (!r.slot || r.slot.status !== 'open') return false;
    const t = new Date(`${r.slot.date}T${r.slot.start_time}`);
    return t >= startMin && t <= startMax;
  });
  if (candidates.length === 0) return 0;

  // Filtre les déjà-envoyés (idempotence)
  const ids = candidates.map((r: any) => r.id);
  const { data: alreadySent } = await supabase
    .from('notification_log')
    .select('reservation_id')
    .in('reservation_id', ids)
    .eq('template', template)
    .in('status', ['sent', 'pending']);

  const seen = new Set((alreadySent ?? []).map((x: any) => x.reservation_id));
  const toEnqueue = candidates
    .filter((r: any) => !seen.has(r.id))
    .map((r: any) => ({
      user_id: r.user_id,
      reservation_id: r.id,
      channel: 'email',
      template,
      status: 'pending',
    }));
  if (toEnqueue.length === 0) return 0;

  const { error: insErr } = await supabase.from('notification_log').insert(toEnqueue);
  if (insErr) return 0;
  return toEnqueue.length;
}
