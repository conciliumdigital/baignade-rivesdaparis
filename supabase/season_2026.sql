-- =====================================================================
-- SAISON 2026 — Génération des créneaux réels (PRODUCTION)
-- =====================================================================
-- Modèle opérationnel confirmé par la mairie (Delphine) le 2026-05-29.
-- À coller dans le SQL Editor Supabase :
--   https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/sql/new
--
-- Saison : 4 juillet au 30 août 2026 (58 jours).
--
-- SEMAINE (lundi à vendredi, hors jours fériés) :
--   10h00 à 11h00  privé (bassin réservé aux enfants de la ville), non public
--   11h00 à 12h00  public, 1 EUR pour tous (nocéen compris)
--   12h00 à 14h00 / 14h00 à 16h00 / 16h00 à 18h00  public, 5 EUR, nocéen 2 EUR
--
-- WEEK-END ET JOURS FÉRIÉS (samedi, dimanche, 14 juillet) :
--   10h00 à 12h00 ... 18h00 à 20h00  public, 5 EUR, nocéen 2 EUR (créneaux de 2h)
--
-- INAUGURATION (samedi 4 juillet) : cérémonie de 14h à 16h, puis baignade
--   GRATUITE de 16h à 20h. Seuls deux créneaux sont ouverts ce jour-là :
--   16h00 à 18h00 et 18h00 à 20h00, à 0 EUR pour tous. Aucun créneau avant 16h.
--
-- Jours fériés dans la période : 14 juillet (mardi) et 15 août (samedi).
--   Le 15 août est déjà un samedi (grille week-end appliquée d'office).
--   Le 14 juillet (mardi) bascule sur la grille week-end (10h-20h public),
--   sans le créneau privé enfants.
--
-- Tarif groupe (3 EUR par personne, à partir de 10 personnes) : il n'existe
--   pas de colonne de prix groupe sur les créneaux. Ce tarif se gère hors
--   créneau (code de réduction ou logique de réservation), pas ici.
--
-- Capacité : 200 par créneau (provisoire, ajustable en back-office).
-- Tag notes = 'SAISON2026' (non purgé par supabase/demo/99_cleanup_demo.sql).
-- Idempotent : peut être relancé sans risque (voir étape 0).
-- =====================================================================

-- ---------------------------------------------------------------------
-- 0. Nettoyage idempotent (sûr) : retire les créneaux SAISON2026 SANS
--    aucune réservation, afin de régénérer une grille propre et conforme
--    (corrige notamment un 4 juillet / 14 juillet issus d'une ancienne
--    version de ce script). Les créneaux déjà réservés ne sont JAMAIS
--    touchés (FK on delete restrict + filtre explicite ci-dessous).
-- ---------------------------------------------------------------------
delete from public.slots
 where notes = 'SAISON2026'
   and id not in (select slot_id from public.reservations);

-- ---------------------------------------------------------------------
-- 1. Semaine (lundi à vendredi), hors jours fériés
-- ---------------------------------------------------------------------
insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents, capacity_groups,
   price_cents, price_resident_cents, price_child_cents, status, notes)
select d::date, t.s, t.e, 200, 0, 0, t.p, t.pr, t.pc, t.st::slot_status, 'SAISON2026'
from generate_series(date '2026-07-04', date '2026-08-30', interval '1 day') d
cross join (values
  (time '10:00', time '11:00',   0,   0,   0, 'private'),  -- enfants de la ville
  (time '11:00', time '12:00', 100, 100, 100, 'open'),     -- 1 EUR pour tous
  (time '12:00', time '14:00', 500, 200, 500, 'open'),
  (time '14:00', time '16:00', 500, 200, 500, 'open'),
  (time '16:00', time '18:00', 500, 200, 500, 'open')
) as t(s, e, p, pr, pc, st)
where extract(dow from d) between 1 and 5
  and d::date not in (date '2026-07-14', date '2026-08-15')
on conflict (date, start_time) do nothing;

-- ---------------------------------------------------------------------
-- 2. Week-end + jours fériés (hors 4 juillet), 10h-20h, 100 % public
-- ---------------------------------------------------------------------
insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents, capacity_groups,
   price_cents, price_resident_cents, price_child_cents, status, notes)
select d::date, t.s, t.e, 200, 0, 0, 500, 200, 500, 'open'::slot_status, 'SAISON2026'
from generate_series(date '2026-07-04', date '2026-08-30', interval '1 day') d
cross join (values
  (time '10:00', time '12:00'),
  (time '12:00', time '14:00'),
  (time '14:00', time '16:00'),
  (time '16:00', time '18:00'),
  (time '18:00', time '20:00')
) as t(s, e)
where (extract(dow from d) in (0, 6) or d::date in (date '2026-07-14', date '2026-08-15'))
  and d::date <> date '2026-07-04'
on conflict (date, start_time) do nothing;

-- ---------------------------------------------------------------------
-- 3. Inauguration — samedi 4 juillet : gratuit de 16h à 20h, rien avant
-- ---------------------------------------------------------------------
insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents, capacity_groups,
   price_cents, price_resident_cents, price_child_cents, status, notes)
values
  (date '2026-07-04', time '16:00', time '18:00', 200, 0, 0, 0, 0, 0, 'open', 'SAISON2026'),
  (date '2026-07-04', time '18:00', time '20:00', 200, 0, 0, 0, 0, 0, 'open', 'SAISON2026')
on conflict (date, start_time) do nothing;

-- ---------------------------------------------------------------------
-- Contrôles
-- ---------------------------------------------------------------------
-- a) Récapitulatif par type de jour
select
  case
    when date = date '2026-07-04'                      then '4 juillet (inauguration)'
    when date in (date '2026-07-14', date '2026-08-15') then 'jour férié'
    when extract(dow from date) in (0, 6)              then 'week-end'
    else 'semaine'
  end as type_jour,
  count(*) filter (where status = 'open')    as creneaux_publics,
  count(*) filter (where status = 'private') as creneaux_prives,
  min(start_time) as premier_debut,
  max(end_time)   as dernier_fin
from public.slots
where notes = 'SAISON2026'
group by 1
order by 1;

-- b) Vérification 4 juillet : doit afficher 2 créneaux à 0 EUR, 16h à 20h
select date, start_time, end_time, price_cents, price_resident_cents, status
from public.slots
where notes = 'SAISON2026' and date = date '2026-07-04'
order by start_time;

-- c) Vérification 14 juillet : doit afficher 5 créneaux publics 10h à 20h,
--    aucun créneau privé
select date, start_time, end_time, price_cents, status
from public.slots
where notes = 'SAISON2026' and date = date '2026-07-14'
order by start_time;

-- Pour TOUT annuler (avant ouverture publique uniquement) :
--   delete from public.slots where notes = 'SAISON2026';
