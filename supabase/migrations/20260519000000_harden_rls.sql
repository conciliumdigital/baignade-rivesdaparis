-- =====================================================================
-- DURCISSEMENT SÉCURITÉ : RLS / triggers (audit 2026-05-19)
-- =====================================================================
-- Corrige 3 failles confirmées par l'audit :
--  - Vuln 1 (CRITIQUE) : escalade de privilège. La policy
--    `profiles_update_own` (UPDATE, USING auth.uid()=id OR is_admin(),
--    SANS WITH CHECK) laisse tout usager modifier SON `role` → admin.
--  - Vuln 2 (HIGH) : `total_amount_cents`/`usager_type` fournis par le
--    client et insérés tels quels → réservation payable 0,01 € / faux
--    tarif habitant sans justificatif.
--  - Vuln 3 (HIGH) : `reservations_update_own` sans WITH CHECK → un
--    usager passe sa résa en `confirmed` + forge un `qr_code_token`
--    sans payer.
--
-- Principe : `auth.uid() IS NULL` = contexte backend de confiance
-- (service_role des Edge Functions, SQL Editor, seeds) → autorisé.
-- L'enforcement colonne par colonne se fait par TRIGGER (la RLS ne peut
-- pas comparer OLD/NEW). Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Vuln 1, profiles : interdire l'auto-modification de role / is_resident
-- ---------------------------------------------------------------------
create or replace function public.prevent_privilege_self_escalation()
returns trigger as $$
begin
  -- Contexte backend (service_role, SQL Editor, seeds) : auth.uid() NULL
  if auth.uid() is null then
    return new;
  end if;
  if new.role is distinct from old.role and not public.is_admin() then
    raise exception 'Modification du rôle non autorisée';
  end if;
  if new.is_resident is distinct from old.is_resident
     and not public.is_staff_or_admin() then
    raise exception 'Modification du statut résident non autorisée';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_profiles_no_self_escalation on public.profiles;
create trigger trg_profiles_no_self_escalation
  before update on public.profiles
  for each row execute function public.prevent_privilege_self_escalation();

-- WITH CHECK explicite (clarté + défense en profondeur)
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id or public.is_admin())
  with check (auth.uid() = id or public.is_admin());

-- ---------------------------------------------------------------------
-- Vuln 2, reservations : recalcul serveur du montant à l'INSERT usager
-- ---------------------------------------------------------------------
create or replace function public.secure_reservation_insert()
returns trigger as $$
declare
  s public.slots%rowtype;
  adult_cents int;
begin
  -- Backend de confiance (webhook, seeds, SQL Editor) : ne pas réécrire
  if auth.uid() is null or public.is_staff_or_admin() then
    return new;
  end if;

  select * into s from public.slots where id = new.slot_id;
  if not found then
    raise exception 'Créneau introuvable';
  end if;

  -- Tarif habitant uniquement si un justificatif est joint
  if new.usager_type = 'habitant' and new.resident_proof_url is null then
    new.usager_type := 'exterieur';
  end if;

  adult_cents := case
    when new.usager_type = 'habitant'
         and s.price_resident_cents is not null
         and s.price_resident_cents > 0
         and s.price_resident_cents < s.price_cents
      then s.price_resident_cents
    else s.price_cents
  end;

  -- Tarif enfant = tarif adulte (décision Phase 1)
  new.total_amount_cents := new.nb_adults * adult_cents
                          + new.nb_children * adult_cents;

  -- L'usager ne peut pas s'auto-confirmer ni se forger un QR / paiement
  new.status := 'pending_payment';
  new.qr_code_token := null;
  new.qr_used_at := null;
  new.scanned_by := null;
  new.stripe_session_id := null;
  new.stripe_payment_intent := null;
  new.stripe_refund_id := null;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_reservations_secure_insert on public.reservations;
create trigger trg_reservations_secure_insert
  before insert on public.reservations
  for each row execute function public.secure_reservation_insert();

-- ---------------------------------------------------------------------
-- Vuln 3, reservations : un usager ne peut qu'ANNULER sa résa
-- ---------------------------------------------------------------------
create or replace function public.secure_reservation_update()
returns trigger as $$
begin
  if auth.uid() is null or public.is_staff_or_admin() then
    return new;  -- backend / staff : plein contrôle
  end if;

  -- Seule transition autorisée côté usager : -> cancelled
  if new.status is distinct from old.status then
    if not (old.status in ('pending_payment','confirmed')
            and new.status = 'cancelled') then
      raise exception 'Transition de statut non autorisée';
    end if;
  end if;

  -- Colonnes sensibles figées pour l'usager
  if new.total_amount_cents   is distinct from old.total_amount_cents
  or new.qr_code_token        is distinct from old.qr_code_token
  or new.qr_used_at           is distinct from old.qr_used_at
  or new.scanned_by           is distinct from old.scanned_by
  or new.stripe_session_id    is distinct from old.stripe_session_id
  or new.stripe_payment_intent is distinct from old.stripe_payment_intent
  or new.stripe_refund_id     is distinct from old.stripe_refund_id
  or new.slot_id              is distinct from old.slot_id
  or new.user_id              is distinct from old.user_id
  or new.usager_type          is distinct from old.usager_type
  or new.nb_adults            is distinct from old.nb_adults
  or new.nb_children          is distinct from old.nb_children then
    raise exception 'Modification non autorisée de la réservation';
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_reservations_secure_update on public.reservations;
create trigger trg_reservations_secure_update
  before update on public.reservations
  for each row execute function public.secure_reservation_update();

drop policy if exists reservations_update_own on public.reservations;
create policy reservations_update_own on public.reservations for update
  using (auth.uid() = user_id or public.is_staff_or_admin())
  with check (auth.uid() = user_id or public.is_staff_or_admin());

-- ---------------------------------------------------------------------
-- Contrôle rapide
-- ---------------------------------------------------------------------
select tgname, tgrelid::regclass as table
from pg_trigger
where tgname in (
  'trg_profiles_no_self_escalation',
  'trg_reservations_secure_insert',
  'trg_reservations_secure_update'
)
order by tgname;
