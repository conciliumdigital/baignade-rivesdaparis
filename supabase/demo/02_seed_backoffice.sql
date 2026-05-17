-- =====================================================================
-- DEMO — Partie B : back-office (OPTIONNEL / AVANCÉ)
-- =====================================================================
-- À exécuter APRÈS 01_seed_slots.sql, dans le SQL Editor Supabase.
--
-- Crée des usagers de démo + réservations + avis de satisfaction pour
-- alimenter le TABLEAU DE BORD admin (réservations, recettes, no-show,
-- note moyenne), la liste des réservations et la page satisfaction.
--
-- 🔒 SÉCURITÉ — Les comptes de démo sont VOLONTAIREMENT NON CONNECTABLES :
--    aucun mot de passe (pas de `encrypted_password`) ET `banned_until`
--    fixé en 2999 → GoTrue refuse toute connexion (mot de passe ET magic
--    link). Ils servent uniquement de propriétaires FK pour les données
--    de démo. Pour démontrer le back-office, l'opérateur se connecte avec
--    SON PROPRE compte admin réel (Magic Link). On ne crée JAMAIS de
--    compte privilégié connectable avec un secret commité.
--
-- ⚠️ AVERTISSEMENTS
--  - Insère dans auth.users (le trigger on_auth_user_created crée les
--    profils automatiquement). Le jeu de colonnes auth.users peut varier
--    selon la version de GoTrue ; si une colonne manque/erreur, ce script
--    est sans danger (transaction) : corriger puis relancer.
--  - À exécuter UNE SEULE FOIS. Pour rejouer : lancer d'abord
--    99_cleanup_demo.sql. Un garde-fou `not exists` empêche les doublons
--    et les conflits avec le trigger anti-overbooking.
--  - Emails en @demo.lesrivesdeparis.fr, références 'DEMO-…' → purge facile.
--  - Toujours lancer 99_cleanup_demo.sql avant l'ouverture publique réelle.
-- =====================================================================

begin;

-- ---------------------------------------------------------------------
-- 1) Usagers de démo (auth.users) — le trigger crée les profils
-- ---------------------------------------------------------------------
insert into auth.users (
  instance_id, id, aud, role, email, banned_until,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values
  ('00000000-0000-0000-0000-000000000000','11111111-1111-1111-1111-111111111111','authenticated','authenticated','demo.admin@demo.lesrivesdeparis.fr',   timestamptz '2999-12-31 00:00:00+00', now(), now(), now(), '{"provider":"email","providers":["email"]}','{"first_name":"Camille","last_name":"Dubois"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','22222222-2222-2222-2222-222222222222','authenticated','authenticated','demo.manager@demo.lesrivesdeparis.fr', timestamptz '2999-12-31 00:00:00+00', now(), now(), now(), '{"provider":"email","providers":["email"]}','{"first_name":"Bruno","last_name":"Lefevre"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','33333333-3333-3333-3333-333333333333','authenticated','authenticated','demo.agent@demo.lesrivesdeparis.fr',   timestamptz '2999-12-31 00:00:00+00', now(), now(), now(), '{"provider":"email","providers":["email"]}','{"first_name":"Awa","last_name":"Traore"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','44444444-4444-4444-4444-444444444444','authenticated','authenticated','demo.martin@demo.lesrivesdeparis.fr',  timestamptz '2999-12-31 00:00:00+00', now(), now(), now(), '{"provider":"email","providers":["email"]}','{"first_name":"Julie","last_name":"Martin"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','55555555-5555-5555-5555-555555555555','authenticated','authenticated','demo.bernard@demo.lesrivesdeparis.fr', timestamptz '2999-12-31 00:00:00+00', now(), now(), now(), '{"provider":"email","providers":["email"]}','{"first_name":"Sophie","last_name":"Bernard"}','','','',''),
  ('00000000-0000-0000-0000-000000000000','66666666-6666-6666-6666-666666666666','authenticated','authenticated','demo.petit@demo.lesrivesdeparis.fr',   timestamptz '2999-12-31 00:00:00+00', now(), now(), now(), '{"provider":"email","providers":["email"]}','{"first_name":"Lucas","last_name":"Petit"}','','','','')
on conflict (id) do nothing;

-- ---------------------------------------------------------------------
-- 2) Rôles / statut résident sur les profils (créés par le trigger)
-- ---------------------------------------------------------------------
update public.profiles set role = 'admin',   first_name='Camille', last_name='Dubois'  where id = '11111111-1111-1111-1111-111111111111';
update public.profiles set role = 'manager', first_name='Bruno',   last_name='Lefevre' where id = '22222222-2222-2222-2222-222222222222';
update public.profiles set role = 'staff',   first_name='Awa',     last_name='Traore'  where id = '33333333-3333-3333-3333-333333333333';
update public.profiles set role = 'user', is_resident = true,  first_name='Julie',  last_name='Martin'  where id = '44444444-4444-4444-4444-444444444444';
update public.profiles set role = 'user', is_resident = true,  first_name='Sophie', last_name='Bernard' where id = '55555555-5555-5555-5555-555555555555';
update public.profiles set role = 'user', is_resident = false, first_name='Lucas',  last_name='Petit'   where id = '66666666-6666-6666-6666-666666666666';

-- ---------------------------------------------------------------------
-- 3) Réservations de démo
--    Garde-fou : ne s'exécute QUE si aucune résa 'DEMO-' n'existe
--    (évite doublons + conflit du trigger anti-overbooking au re-run).
--    slot_id résolu par (date, start_time) parmi les créneaux DEMO ouverts.
-- ---------------------------------------------------------------------
insert into public.reservations
  (reference, user_id, slot_id, status, usager_type, nb_adults, nb_children,
   total_amount_cents, qr_code_token, qr_used_at, honor_certification, resident_proof_url)
select v.reference, v.user_id, s.id, v.status::reservation_status, v.usager_type::usager_type,
       v.nb_adults, v.nb_children, v.total_amount_cents, v.qr_code_token,
       v.qr_used_at, v.honor_certification, v.resident_proof_url
from (values
  -- (ref, user, slot_date, slot_start, status, usager_type, adultes, enfants, total_cts, qr, qr_used_at, honor, proof)
  ('DEMO-0001','44444444-4444-4444-4444-444444444444', date '2026-07-06', time '10:00','used',     'habitant', 2,2, 2*300+2*250,'DEMO-QR-0001', now(), true,  '44444444-4444-4444-4444-444444444444/DEMO-0001.pdf'),
  ('DEMO-0002','66666666-6666-6666-6666-666666666666', date '2026-07-06', time '10:00','used',     'exterieur',2,0, 2*500,      'DEMO-QR-0002', now(), false, null),
  ('DEMO-0003','55555555-5555-5555-5555-555555555555', date '2026-07-06', time '14:00','confirmed','habitant', 1,3, 1*300+3*250,'DEMO-QR-0003', null, true,  '55555555-5555-5555-5555-555555555555/DEMO-0003.jpg'),
  ('DEMO-0004','66666666-6666-6666-6666-666666666666', date '2026-07-07', time '12:00','confirmed','exterieur',3,1, 3*500+1*250,'DEMO-QR-0004', null, false, null),
  ('DEMO-0005','44444444-4444-4444-4444-444444444444', date '2026-07-07', time '16:00','confirmed','habitant', 2,0, 2*300,      'DEMO-QR-0005', null, true,  '44444444-4444-4444-4444-444444444444/DEMO-0005.pdf'),
  ('DEMO-0006','55555555-5555-5555-5555-555555555555', date '2026-07-08', time '10:00','used',     'habitant', 2,2, 2*300+2*250,'DEMO-QR-0006', now(), true,  '55555555-5555-5555-5555-555555555555/DEMO-0006.png'),
  ('DEMO-0007','66666666-6666-6666-6666-666666666666', date '2026-07-08', time '18:00','no_show',  'exterieur',2,0, 2*500,      'DEMO-QR-0007', null, false, null),
  ('DEMO-0008','44444444-4444-4444-4444-444444444444', date '2026-07-10', time '14:00','confirmed','habitant', 1,1, 1*300+1*250,'DEMO-QR-0008', null, true,  '44444444-4444-4444-4444-444444444444/DEMO-0008.pdf'),
  ('DEMO-0009','55555555-5555-5555-5555-555555555555', date '2026-07-11', time '12:00','confirmed','habitant', 2,1, 2*300+1*250,'DEMO-QR-0009', null, true,  '55555555-5555-5555-5555-555555555555/DEMO-0009.jpg'),
  ('DEMO-0010','66666666-6666-6666-6666-666666666666', date '2026-07-11', time '16:00','cancelled','exterieur',4,0, 4*500,      'DEMO-QR-0010', null, false, null),
  ('DEMO-0011','44444444-4444-4444-4444-444444444444', date '2026-07-12', time '10:00','used',     'habitant', 2,3, 2*300+3*250,'DEMO-QR-0011', now(), true,  '44444444-4444-4444-4444-444444444444/DEMO-0011.pdf'),
  ('DEMO-0012','66666666-6666-6666-6666-666666666666', date '2026-07-12', time '14:00','confirmed','exterieur',2,2, 2*500+2*250,'DEMO-QR-0012', null, false, null),
  ('DEMO-0013','55555555-5555-5555-5555-555555555555', date '2026-07-13', time '18:00','confirmed','habitant', 1,0, 1*300,      'DEMO-QR-0013', null, true,  '55555555-5555-5555-5555-555555555555/DEMO-0013.png'),
  ('DEMO-0014','66666666-6666-6666-6666-666666666666', date '2026-07-14', time '12:00','confirmed','exterieur',2,1, 2*500+1*250,'DEMO-QR-0014', null, false, null),
  ('DEMO-0015','44444444-4444-4444-4444-444444444444', date '2026-07-15', time '16:00','confirmed','habitant', 3,2, 3*300+2*250,'DEMO-QR-0015', null, true,  '44444444-4444-4444-4444-444444444444/DEMO-0015.pdf'),
  ('DEMO-0016','55555555-5555-5555-5555-555555555555', date '2026-07-16', time '10:00','confirmed','habitant', 2,0, 2*300,      'DEMO-QR-0016', null, true,  '55555555-5555-5555-5555-555555555555/DEMO-0016.jpg'),
  ('DEMO-0017','66666666-6666-6666-6666-666666666666', date '2026-07-17', time '14:00','no_show',  'exterieur',1,0, 1*500,      'DEMO-QR-0017', null, false, null),
  ('DEMO-0018','44444444-4444-4444-4444-444444444444', date '2026-07-18', time '18:00','confirmed','habitant', 2,2, 2*300+2*250,'DEMO-QR-0018', null, true,  '44444444-4444-4444-4444-444444444444/DEMO-0018.pdf'),
  ('DEMO-0019','55555555-5555-5555-5555-555555555555', date '2026-07-19', time '12:00','confirmed','habitant', 1,1, 1*300+1*250,'DEMO-QR-0019', null, true,  '55555555-5555-5555-5555-555555555555/DEMO-0019.png'),
  ('DEMO-0020','66666666-6666-6666-6666-666666666666', date '2026-07-19', time '16:00','pending_payment','exterieur',2,0, 2*500, 'DEMO-QR-0020', null, false, null)
) as v(reference,user_id,slot_date,slot_start,status,usager_type,nb_adults,nb_children,total_amount_cents,qr_code_token,qr_used_at,honor_certification,resident_proof_url)
join public.slots s
  on s.date = v.slot_date and s.start_time = v.slot_start
 and s.notes = 'DEMO' and s.status = 'open'
where not exists (select 1 from public.reservations where reference like 'DEMO-%')
on conflict (reference) do nothing;

-- ---------------------------------------------------------------------
-- 4) Avis de satisfaction (alimente "Note moyenne" + page Satisfaction)
-- ---------------------------------------------------------------------
insert into public.satisfaction_responses
  (reservation_id, user_id, rating_overall, rating_cleanliness, rating_staff, comment, nps)
select r.id, r.user_id, v.ro, v.rc, v.rs, v.cmt, v.nps
from (values
  ('DEMO-0001', 5,5,5,'DEMO — Super après-midi, eau impeccable et personnel adorable !',10),
  ('DEMO-0002', 4,4,5,'DEMO — Très bien organisé, le QR code à l''entrée est pratique.',9),
  ('DEMO-0006', 5,4,5,'DEMO — Tarif habitant très appréciable, on reviendra en famille.',10),
  ('DEMO-0011', 3,3,4,'DEMO — Bien mais un peu de monde sur le créneau de 10h.',7),
  ('DEMO-0003', 5,5,4,'DEMO — Réservation en 2 minutes, parfait pour les parents.',9),
  ('DEMO-0009', 4,5,4,'DEMO — Site agréable, vestiaires propres.',8),
  ('DEMO-0013', 2,3,3,'DEMO — Créneau écourté pour cause de météo, remboursement reçu rapidement.',6),
  ('DEMO-0016', 5,5,5,'DEMO — Rien à redire, expérience au top.',10)
) as v(reference,ro,rc,rs,cmt,nps)
join public.reservations r on r.reference = v.reference
where not exists (
  select 1 from public.satisfaction_responses where comment like 'DEMO —%'
);

commit;

-- Contrôle rapide (doit refléter le tableau de bord)
select
  (select count(*) from public.reservations where reference like 'DEMO-%') as resas_demo,
  (select coalesce(sum(total_amount_cents),0) from public.reservations
     where reference like 'DEMO-%' and status in ('confirmed','used')) as recettes_cts,
  (select count(*) from public.reservations where reference like 'DEMO-%' and status='no_show') as no_show,
  (select round(avg(rating_overall),2) from public.satisfaction_responses where comment like 'DEMO —%') as note_moy;
