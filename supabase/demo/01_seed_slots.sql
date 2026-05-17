-- =====================================================================
-- DEMO — Partie A : créneaux (SÛR, à exécuter en premier)
-- =====================================================================
-- À coller dans le SQL Editor Supabase :
--   https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/sql/new
--
-- Crée 2 semaines de créneaux réalistes (6 → 19 juillet 2026) pour que
-- le calendrier public et le tunnel de réservation soient pleinement
-- démontrables sur https://baignade.lesrivesdeparis.fr.
--
-- 100 % idempotent (on conflict do nothing) — rejouable sans risque.
-- Toutes les lignes sont taguées notes='DEMO' → nettoyage facile
-- (voir 99_cleanup_demo.sql).
-- =====================================================================

insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents,
   price_cents, price_resident_cents, price_child_cents, status, notes)
select
  d::date,
  t.s,
  t.e,
  50,
  20,
  500,   -- 5,00 € tarif extérieur
  300,   -- 3,00 € tarif habitant Neuilly
  250,   -- 2,50 € enfant
  case
    when d::date = date '2026-07-09' and t.s = time '10:00' then 'closed'::slot_status
    else 'open'::slot_status
  end,
  'DEMO'
from generate_series(date '2026-07-06', date '2026-07-19', interval '1 day') d
cross join (values
  (time '10:00', time '12:00'),
  (time '12:00', time '14:00'),
  (time '14:00', time '16:00'),
  (time '16:00', time '18:00'),
  (time '18:00', time '20:00')
) as t(s, e)
on conflict (date, start_time) do nothing;

-- Motif de fermeture sur le créneau "météo" (pour démontrer la gestion
-- des fermetures / notification usagers)
update public.slots
set closure_reason = 'Alerte météo — orages annoncés, baignade suspendue'
where date = date '2026-07-09' and start_time = time '10:00' and notes = 'DEMO';

-- Contrôle rapide
select date, count(*) as creneaux,
       sum((status = 'open')::int) as ouverts,
       sum((status = 'closed')::int) as fermes
from public.slots
where notes = 'DEMO'
group by date order by date;
