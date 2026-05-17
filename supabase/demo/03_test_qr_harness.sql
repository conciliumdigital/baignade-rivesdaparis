-- =====================================================================
-- TEST — Harnais de validation QR + scan (Stripe NON requis)
-- =====================================================================
-- À coller dans le SQL Editor Supabase :
--   https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/sql/new
--
-- POURQUOI : en prod, le `qr_code_token` est généré par le webhook Stripe
-- (paiement validé). Stripe n'étant pas configuré, ce script crée
-- directement une réservation CONFIRMÉE avec un QR, datée du JOUR, pour
-- valider de bout en bout :
--   - l'affichage du QR (rendu par le front à partir du token)
--   - le SCAN par un agent (Edge Function `scan-qr`, sécurisée PR #8)
--   - l'anti-réutilisation (2ᵉ scan → « Déjà utilisé »)
--
-- CE QUE ÇA NE TESTE PAS : le chemin de génération via webhook Stripe
-- (trivial : `BAIGNADE-<uuid>`), qui nécessite Stripe.
--
-- SÉCURITÉ : l'utilisateur de test est VOLONTAIREMENT non connectable
-- (aucun mot de passe + banned_until 2999), rôle `user`. Données taguées
-- TEST (notes='TEST', reference 'TEST-%', email @test.lesrivesdeparis.fr)
-- → purge via 99_cleanup_demo.sql.
--
-- 100 % idempotent. Rejouable. Le créneau est daté `current_date` (UTC)
-- pour que le contrôle « créneau d'aujourd'hui » de `scan-qr` passe.
-- =====================================================================

begin;

-- 1) Utilisateur de test — NON connectable (le trigger crée le profil)
insert into auth.users (
  instance_id, id, aud, role, email, banned_until,
  email_confirmed_at, created_at, updated_at,
  raw_app_meta_data, raw_user_meta_data,
  confirmation_token, recovery_token, email_change_token_new, email_change
)
values (
  '00000000-0000-0000-0000-000000000000',
  '77777777-7777-7777-7777-777777777777',
  'authenticated','authenticated',
  'qr.test@test.lesrivesdeparis.fr',
  timestamptz '2999-12-31 00:00:00+00',
  now(), now(), now(),
  '{"provider":"email","providers":["email"]}',
  '{"first_name":"Usager","last_name":"Test QR"}',
  '','','',''
)
on conflict (id) do nothing;

-- 2) Créneau de test 0 € daté d'AUJOURD'HUI (UTC), ouvert
insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents,
   price_cents, price_resident_cents, price_child_cents, status, notes)
values
  (current_date, time '10:00', time '12:00', 50, 20, 0, 0, 0, 'open', 'TEST')
on conflict (date, start_time) do nothing;

-- 3) Réservation CONFIRMÉE avec QR (garde-fou anti-doublon + anti-trigger)
insert into public.reservations
  (reference, user_id, slot_id, status, usager_type, nb_adults, nb_children,
   total_amount_cents, qr_code_token, honor_certification)
select
  'TEST-0001',
  '77777777-7777-7777-7777-777777777777',
  s.id,
  'confirmed', 'habitant', 2, 2,
  0,
  'BAIGNADE-TEST-0001',
  true
from public.slots s
where s.date = current_date and s.start_time = time '10:00' and s.notes = 'TEST'
  and not exists (select 1 from public.reservations where reference = 'TEST-0001')
on conflict (reference) do nothing;

commit;

-- ---------------------------------------------------------------------
-- Vérification + mode d'emploi
-- ---------------------------------------------------------------------
select r.reference, r.status, r.qr_code_token, s.date, s.start_time, s.status as slot_status
from public.reservations r
join public.slots s on s.id = r.slot_id
where r.reference = 'TEST-0001';

-- ► COMMENT TESTER LE SCAN
--   1. Générez un QR encodant EXACTEMENT la chaîne : BAIGNADE-TEST-0001
--      (n'importe quel générateur de QR, ou affichez-le côté front).
--   2. Un agent CONNECTÉ et de rôle staff/admin/manager ouvre /staff
--      sur mobile et scanne ce QR.
--      → Attendu : écran vert « Accès autorisé », badge « Tarif habitant »,
--        détail « 2 adultes, 2 enfants ».
--   3. Re-scannez le même QR.
--      → Attendu : écran orange « Déjà utilisé » (anti-fraude OK).
--
-- ► POUR VOIR LE QR RENDU PAR L'APP (optionnel)
--   Rattachez la résa à VOTRE profil : remplacez à la ligne 3) le user_id
--   par (select id from public.profiles where email='VOTRE.EMAIL'), puis
--   connectez-vous et ouvrez /compte → la réservation TEST affiche son QR.
--
-- ► RAZ pour rejouer : delete from public.reservations where reference='TEST-0001';
--   (ou 99_cleanup_demo.sql qui purge aussi tout le contenu TEST)
