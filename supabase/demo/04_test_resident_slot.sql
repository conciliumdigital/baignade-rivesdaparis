-- =====================================================================
-- TEST — Créneau « tarif habitant » pour valider le formulaire usager
-- =====================================================================
-- À coller dans le SQL Editor Supabase :
--   https://supabase.com/dashboard/project/nunglkeqekxzpmushxty/sql/new
--
-- POURQUOI : l'upload du justificatif de domicile + la case
-- « sur l'honneur » n'apparaissent dans le tunnel que si le créneau
-- consulté a price_resident_cents > 0 ET que l'usager sélectionne la
-- carte « Tarif habitant ». Le créneau du harnais 03 est à 0 € (option
-- habitant volontairement masquée). Ce script crée un créneau NORMAL
-- avec tarif habitant > 0, daté dans 7 jours, pour exercer le formulaire.
--
-- Idempotent (on conflict). Tagué TEST → purge via 99_cleanup_demo.sql.
-- =====================================================================

insert into public.slots
  (date, start_time, end_time, capacity, capacity_residents,
   price_cents, price_resident_cents, price_child_cents, status, notes)
values
  (current_date + 7, time '14:00', time '16:00', 50, 20, 500, 300, 250, 'open', 'TEST')
on conflict (date, start_time) do nothing;

-- Contrôle + mode d'emploi
select date, start_time, price_cents, price_resident_cents, status, notes
from public.slots
where notes = 'TEST' and date = current_date + 7;

-- ► COMMENT TESTER LE FORMULAIRE TARIF HABITANT
--   1. Ouvrez https://baignade.lesrivesdeparis.fr/reserver
--   2. Choisissez le créneau daté dans 7 jours, 14h–16h.
--   3. Dans le formulaire, cliquez la carte « Tarif habitant »
--      (par défaut « Tarif extérieur » est sélectionné).
--      → Apparaissent : l'upload du justificatif (JPG/PNG/WEBP/PDF, 5 Mo)
--        + la case « Je certifie sur l'honneur… ».
--   4. Le prix passe de 5,00 € à 3,00 € (adulte) en temps réel.
--
-- ► RAZ : delete from public.slots where notes='TEST' and date=current_date+7;
--   (ou 99_cleanup_demo.sql qui purge tout le contenu TEST)
