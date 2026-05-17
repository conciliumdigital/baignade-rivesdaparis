-- =====================================================================
-- DEMO — Nettoyage : purge TOUTES les données de démonstration
-- =====================================================================
-- À exécuter dans le SQL Editor Supabase AVANT la mise en service réelle
-- (ou pour rejouer 02_seed_backoffice.sql proprement).
--
-- Cible uniquement les données taguées DEMO et TEST :
--   - slots.notes IN ('DEMO','TEST')
--   - reservations.reference LIKE 'DEMO-%' OU 'TEST-%'
--   - satisfaction_responses.comment LIKE 'DEMO —%'
--   - auth.users.email LIKE '%@demo.lesrivesdeparis.fr' OU '%@test.lesrivesdeparis.fr'
--     (cascade profils)
--
-- Ordre FK-safe. Idempotent (rejouable sans risque).
-- =====================================================================

begin;

-- 1) Avis de satisfaction de démo
delete from public.satisfaction_responses
where comment like 'DEMO —%'
   or reservation_id in (select id from public.reservations
                         where reference like 'DEMO-%' or reference like 'TEST-%');

-- 2) Journaux de scan liés aux résas de démo (sécurité)
delete from public.scan_log
where reservation_id in (select id from public.reservations
                        where reference like 'DEMO-%' or reference like 'TEST-%');

-- 3) Réservations de démo (doit précéder la suppression des créneaux :
--    reservations.slot_id est ON DELETE RESTRICT)
delete from public.reservations where reference like 'DEMO-%' or reference like 'TEST-%';

-- 4) Créneaux de démo / test
delete from public.slots where notes in ('DEMO', 'TEST');

-- 5) Usagers de démo / test — la suppression dans auth.users cascade sur
--    public.profiles (profiles.id ON DELETE CASCADE)
delete from auth.users
where email like '%@demo.lesrivesdeparis.fr'
   or email like '%@test.lesrivesdeparis.fr';

commit;

-- Contrôle : tout doit renvoyer 0
select
  (select count(*) from public.slots where notes in ('DEMO','TEST')) as slots_demo_test,
  (select count(*) from public.reservations where reference like 'DEMO-%' or reference like 'TEST-%') as resas_demo_test,
  (select count(*) from public.satisfaction_responses where comment like 'DEMO —%') as avis_demo,
  (select count(*) from auth.users
     where email like '%@demo.lesrivesdeparis.fr' or email like '%@test.lesrivesdeparis.fr') as users_demo_test;
