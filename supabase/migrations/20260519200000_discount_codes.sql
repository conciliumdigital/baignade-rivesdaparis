-- =====================================================================
-- Codes de réduction — sécurisé côté serveur
-- =====================================================================
-- La remise est appliquée AUTORITAIREMENT par le trigger d'insertion
-- (cohérent avec le durcissement anti-fraude tarifaire). Le formulaire
-- ne fait qu'un APERÇU via la fonction compute_discount() — même source
-- de vérité que le trigger. Idempotent.
-- =====================================================================

create table if not exists public.discount_codes (
  code             text primary key,           -- stocké en MAJUSCULES
  label            text,
  kind             text not null check (kind in ('percent','fixed')),
  value            int  not null check (value >= 0),  -- percent: 1..100 | fixed: centimes
  active           boolean not null default true,
  max_uses         int,                          -- null = illimité
  used_count       int  not null default 0,
  valid_from       timestamptz,
  valid_until      timestamptz,
  min_amount_cents int  not null default 0,
  created_at       timestamptz default now(),
  created_by       uuid references public.profiles(id)
);

alter table public.discount_codes enable row level security;

drop policy if exists discount_codes_admin on public.discount_codes;
create policy discount_codes_admin on public.discount_codes for all
  using (public.is_admin()) with check (public.is_admin());

-- Colonnes de réservation
alter table public.reservations
  add column if not exists discount_code  text,
  add column if not exists discount_cents int not null default 0;

-- ---------------------------------------------------------------------
-- Source unique de vérité : valide un code et calcule la remise.
-- Utilisée par l'aperçu front (RPC) ET par le trigger d'insertion.
-- ---------------------------------------------------------------------
create or replace function public.compute_discount(p_code text, p_amount_cents int)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  d public.discount_codes%rowtype;
  disc int := 0;
begin
  if p_code is null or btrim(p_code) = '' then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'aucun code');
  end if;
  select * into d from public.discount_codes where code = upper(btrim(p_code));
  if not found then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'code introuvable');
  end if;
  if not d.active then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'code inactif', 'label', d.label);
  end if;
  if d.valid_from is not null and now() < d.valid_from then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'code pas encore valide', 'label', d.label);
  end if;
  if d.valid_until is not null and now() > d.valid_until then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'code expiré', 'label', d.label);
  end if;
  if d.max_uses is not null and d.used_count >= d.max_uses then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'code épuisé', 'label', d.label);
  end if;
  if p_amount_cents < coalesce(d.min_amount_cents, 0) then
    return jsonb_build_object('valid', false, 'discount_cents', 0, 'reason', 'montant minimum non atteint', 'label', d.label);
  end if;

  if d.kind = 'percent' then
    disc := floor(p_amount_cents * least(d.value, 100) / 100.0);
  else
    disc := d.value;
  end if;
  if disc > p_amount_cents then disc := p_amount_cents; end if;  -- jamais négatif

  return jsonb_build_object('valid', true, 'discount_cents', disc, 'reason', 'ok', 'label', d.label);
end;
$$;

grant execute on function public.compute_discount(text, int) to anon, authenticated;

-- ---------------------------------------------------------------------
-- Extension du trigger d'insertion : applique la remise côté serveur.
-- (Reprend la logique de prix de secure_reservation_insert + remise.)
-- ---------------------------------------------------------------------
create or replace function public.secure_reservation_insert()
returns trigger as $$
declare
  s public.slots%rowtype;
  adult_cents int;
  base_total int;
  disc jsonb;
begin
  if auth.uid() is null or public.is_staff_or_admin() then
    return new;  -- backend / staff : pas de réécriture
  end if;

  select * into s from public.slots where id = new.slot_id;
  if not found then
    raise exception 'Créneau introuvable';
  end if;

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

  base_total := new.nb_adults * adult_cents + new.nb_children * adult_cents;

  -- Remise éventuelle, validée et calculée serveur (jamais le client)
  if new.discount_code is not null and btrim(new.discount_code) <> '' then
    disc := public.compute_discount(new.discount_code, base_total);
    if (disc->>'valid')::boolean then
      new.discount_code  := upper(btrim(new.discount_code));
      new.discount_cents := (disc->>'discount_cents')::int;
    else
      new.discount_code  := null;
      new.discount_cents := 0;
    end if;
  else
    new.discount_code  := null;
    new.discount_cents := 0;
  end if;

  new.total_amount_cents := greatest(base_total - new.discount_cents, 0);

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

-- Comptage des usages : AFTER INSERT (ne compte que les résas réellement créées)
create or replace function public.redeem_discount_after_insert()
returns trigger as $$
begin
  if new.discount_code is not null and new.discount_cents > 0 then
    update public.discount_codes
      set used_count = used_count + 1
      where code = new.discount_code;
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_reservation_discount_redeem on public.reservations;
create trigger trg_reservation_discount_redeem
  after insert on public.reservations
  for each row execute function public.redeem_discount_after_insert();

select 'discount_codes' as ok, count(*) from public.discount_codes;
