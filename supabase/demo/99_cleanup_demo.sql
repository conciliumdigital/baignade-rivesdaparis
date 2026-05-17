-- =====================================================================
-- DEMO — Nettoyage : purge TOUTES les données de démonstration
-- =====================================================================
-- À exécuter dans le SQL Editor Supabase AVANT la mise en service réelle
-- (ou pour rejouer 02_seed_backoffice.sql proprement).
--
-- Cible uniquement les données taguées DEMO :
--   - slots.notes = 'DEMO'
--   - reservations.reference LIKE 'DEMO-%'
--   - satisfaction_responses.comment LIKE 'DEMO —%'
--   - auth.users.email LIKE '%@demo.lesrivesdeparis.fr' (cascade profils)
--
-- Ordre FK-safe. Idempotent (rejouable sans risque).
-- =====================================================================

begin;

-- 1) Avis de satisfaction de démo
delete from public.satisfaction_responses
where comment like 'DEMO —%'
   or reservation_id in (select id from public.reservations where reference like 'DEMO-%');

-- 2) Journaux de scan liés aux résas de démo (sécurité)
delete from public.scan_log
where reservation_id in (select id from public.reservations where reference like 'DEMO-%');

-- 3) Réservations de démo (doit précéder la suppression des créneaux :
--    reservations.slot_id est ON DELETE RESTRICT)
delete from public.reservations where reference like 'DEMO-%';

-- 4) Créneaux de démo
delete from public.slots where notes = 'DEMO';

-- 5) Usagers de démo — la suppression dans auth.users cascade sur
--    public.profiles (profiles.id ON DELETE CASCADE)
delete from auth.users where email like '%@demo.lesrivesdeparis.fr';

commit;

-- Contrôle : tout doit renvoyer 0
select
  (select count(*) from public.slots where notes = 'DEMO') as slots_demo,
  (select count(*) from public.reservations where reference like 'DEMO-%') as resas_demo,
  (select count(*) from public.satisfaction_responses where comment like 'DEMO —%') as avis_demo,
  (select count(*) from auth.users where email like '%@demo.lesrivesdeparis.fr') as users_demo;
