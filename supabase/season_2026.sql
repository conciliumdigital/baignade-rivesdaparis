-- =====================================================================
-- SAISON 2026 — Génération des créneaux réels (PRODUCTION)
-- =====================================================================
-- Modèle opérationnel confirmé par la commune le 2026-05-17.
-- À coller dans le SQL Editor Supabase :
--   https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/sql/new
--
-- Saison : 4 juillet → 30 août 2026.
-- Tag notes='SAISON2026' (NON purgé par supabase/demo/99_cleanup_demo.sql
-- qui ne cible que DEMO/TEST). 100 % idempotent (on conflict do nothing).
--
-- SEMAINE (Lun–Ven), bassin 10h–18h :
--   10h–11h  privé  (cours natation + centres de loisir) — non public
--   11h–12h  public 1 € pour tous (nocéen compris)
--   12h–14h / 14h–16h / 16h–18h  public 5 € · nocéen 2 €
--
-- WEEK-END (Sam/Dim), bassin 10h–20h, 100 % public, que des 2h :
--   10h–12h / 12h–14h / 14h–16h / 16h–18h / 18h–20h  5 € · nocéen 2 €
--
-- Capacité : 200 / créneau (provisoire — à ajuster après mesures des
-- bassins ; modifiable ensuite via le back-office ou un UPDATE).
-- Tarif enfant = tarif adulte (la commune n'a pas défini de tarif
-- enfant/groupe ; price_child_cents aligné, à revoir ultérieurement).
-- =====================================================================

-- Semaine (Lun=1 … Ven=5)
insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents,
   price_cents, price_resident_cents, price_child_cents, status, notes)
select d::date, t.s, t.e, 200, 0, t.p, t.pr, t.pc, t.st::slot_status, 'SAISON2026'
from generate_series(date '2026-07-04', date '2026-08-30', interval '1 day') d
cross join (values
  (time '10:00', time '11:00',   0,   0,   0, 'private'),  -- cours + centres loisir
  (time '11:00', time '12:00', 100, 100, 100, 'open'),      -- public 1 € pour tous
  (time '12:00', time '14:00', 500, 200, 500, 'open'),
  (time '14:00', time '16:00', 500, 200, 500, 'open'),
  (time '16:00', time '18:00', 500, 200, 500, 'open')
) as t(s, e, p, pr, pc, st)
where extract(dow from d) between 1 and 5
on conflict (date, start_time) do nothing;

-- Week-end (Sam=6, Dim=0)
insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents,
   price_cents, price_resident_cents, price_child_cents, status, notes)
select d::date, t.s, t.e, 200, 0, 500, 200, 500, 'open'::slot_status, 'SAISON2026'
from generate_series(date '2026-07-04', date '2026-08-30', interval '1 day') d
cross join (values
  (time '10:00', time '12:00'),
  (time '12:00', time '14:00'),
  (time '14:00', time '16:00'),
  (time '16:00', time '18:00'),
  (time '18:00', time '20:00')
) as t(s, e)
where extract(dow from d) in (0, 6)
on conflict (date, start_time) do nothing;

-- Contrôle : répartition par jour de semaine
select
  to_char(date, 'TMDy') as jour,
  count(*) filter (where status = 'open')    as creneaux_publics,
  count(*) filter (where status = 'private') as creneaux_prives
from public.slots
where notes = 'SAISON2026'
group by 1, extract(dow from date)
order by extract(dow from date);

-- Pour TOUT annuler (avant ouverture publique uniquement) :
-- delete from public.slots where notes = 'SAISON2026';
