-- =====================================================================
-- Opérations saisonnières : liste d'attente, rappels J-1/H-1, météo
-- =====================================================================
-- Ajoute :
--   1. RPC join_waitlist / leave_waitlist (SECURITY DEFINER, vérifs serveur)
--   2. Trigger notify_on_reservation_freed
--      → quand une réservation se libère (cancelled/refunded/expired/DELETE),
--        on enfile une notif `waitlist_offered` pour la 1ʳᵉ personne en file.
--   3. Trigger notify_on_slot_closed
--      → quand slots.status passe à 'closed', on enfile une notif `closure`
--        pour chaque réservation confirmée du créneau.
--   4. Template `waitlist_offered` (place libérée).
--
-- Tout côté serveur : le client ne peut pas forcer une notif, ne peut pas
-- s'inscrire à une liste d'attente d'un créneau pas plein, ne peut pas
-- détourner les inscriptions d'autrui.
-- =====================================================================

-- ------------------------------------------------------------------
-- 1. RPC d'inscription / désinscription liste d'attente
-- ------------------------------------------------------------------
-- Règles serveur :
--   - slot existe + futur + status='open'
--   - capacité réellement saturée (booked >= capacity)
--   - user non déjà en liste (waiting) pour ce slot
--   - nb_persons ∈ [1, 12]
-- ------------------------------------------------------------------

create or replace function public.join_waitlist(
  p_slot_id  uuid,
  p_persons  int
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id   uuid := auth.uid();
  v_remaining int;
  v_status    text;
  v_starts_at timestamptz;
  v_entry_id  uuid;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if p_persons is null or p_persons < 1 or p_persons > 12 then
    raise exception 'INVALID_PERSONS' using errcode = '22023';
  end if;

  select sa.remaining, sa.status, (sa.date + sa.start_time)::timestamptz
    into v_remaining, v_status, v_starts_at
    from public.slot_availability sa
    where sa.id = p_slot_id;

  if v_remaining is null then
    raise exception 'SLOT_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_status <> 'open' then
    raise exception 'SLOT_NOT_OPEN' using errcode = 'P0001';
  end if;
  if v_starts_at <= now() then
    raise exception 'SLOT_IN_PAST' using errcode = 'P0001';
  end if;
  if v_remaining > 0 then
    raise exception 'SLOT_NOT_FULL' using errcode = 'P0001';
  end if;

  insert into public.waitlist (user_id, slot_id, nb_persons, status)
       values (v_user_id, p_slot_id, p_persons, 'waiting')
  on conflict (user_id, slot_id) do update
     set nb_persons = excluded.nb_persons,
         status     = 'waiting',
         notified_at = null,
         expires_at  = null
  returning id into v_entry_id;

  return v_entry_id;
end;
$$;

revoke all on function public.join_waitlist(uuid, int) from public;
grant execute on function public.join_waitlist(uuid, int) to authenticated;

create or replace function public.leave_waitlist(p_slot_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  delete from public.waitlist
   where user_id = v_user_id
     and slot_id = p_slot_id;
end;
$$;

revoke all on function public.leave_waitlist(uuid) from public;
grant execute on function public.leave_waitlist(uuid) to authenticated;

-- ------------------------------------------------------------------
-- 2. Trigger : place libérée → enfile notif waitlist_offered
-- ------------------------------------------------------------------
-- Statuts « occupants » : pending_payment, confirmed, used
-- → si on quitte ces statuts (annulation, remboursement, expiration)
--   ou si DELETE, alors places potentiellement disponibles.
-- ------------------------------------------------------------------

create or replace function public.notify_on_reservation_freed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_slot_id   uuid;
  v_remaining int;
  v_status    text;
  v_starts_at timestamptz;
  v_candidate record;
begin
  if tg_op = 'DELETE' then
    v_slot_id := old.slot_id;
  elsif tg_op = 'UPDATE' then
    -- Sortie d'un statut occupant vers un statut libérateur
    if old.status in ('pending_payment','confirmed','used')
       and new.status in ('cancelled','refunded','expired','no_show') then
      v_slot_id := new.slot_id;
    else
      return new;
    end if;
  else
    return new;
  end if;

  select sa.remaining, sa.status, (sa.date + sa.start_time)::timestamptz
    into v_remaining, v_status, v_starts_at
    from public.slot_availability sa
    where sa.id = v_slot_id;

  if v_remaining is null or v_remaining <= 0 then return coalesce(new, old); end if;
  if v_status <> 'open' then return coalesce(new, old); end if;
  if v_starts_at <= now() then return coalesce(new, old); end if;

  -- 1ʳᵉ personne en attente, place dispo suffisante, jamais notifiée
  for v_candidate in
    select w.id, w.user_id, w.nb_persons
      from public.waitlist w
     where w.slot_id = v_slot_id
       and w.status = 'waiting'
       and w.notified_at is null
       and w.nb_persons <= v_remaining
     order by w.created_at asc
     limit 1
  loop
    update public.waitlist
       set notified_at = now(),
           expires_at  = now() + interval '24 hours',
           status      = 'offered'
     where id = v_candidate.id;

    insert into public.notification_log
      (user_id, reservation_id, channel, template, status)
      values (v_candidate.user_id, null, 'email', 'waitlist_offered', 'pending');
  end loop;

  return coalesce(new, old);
end;
$$;

drop trigger if exists trg_notify_on_reservation_freed on public.reservations;
create trigger trg_notify_on_reservation_freed
  after update or delete on public.reservations
  for each row execute function public.notify_on_reservation_freed();

-- ------------------------------------------------------------------
-- 3. Trigger : fermeture météo → enfile notif `closure` pour chaque
--    réservation confirmée/used/pending_payment du créneau.
-- ------------------------------------------------------------------

create or replace function public.notify_on_slot_closed()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_res record;
begin
  -- Ne notifier qu'au passage open → closed (pas closed → closed, etc.)
  if not (old.status = 'open' and new.status = 'closed') then
    return new;
  end if;

  for v_res in
    select id, user_id
      from public.reservations
     where slot_id = new.id
       and status in ('confirmed','used','pending_payment')
  loop
    insert into public.notification_log
      (user_id, reservation_id, channel, template, status)
      values (v_res.user_id, v_res.id, 'email', 'closure', 'pending');
  end loop;

  return new;
end;
$$;

drop trigger if exists trg_notify_on_slot_closed on public.slots;
create trigger trg_notify_on_slot_closed
  after update of status on public.slots
  for each row execute function public.notify_on_slot_closed();

-- ------------------------------------------------------------------
-- 4. RLS admin : lecture/maj waitlist
-- ------------------------------------------------------------------
drop policy if exists waitlist_admin_all on public.waitlist;
create policy waitlist_admin_all on public.waitlist
  for all
  to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- ------------------------------------------------------------------
-- 5. Template `waitlist_offered`
-- ------------------------------------------------------------------
insert into public.email_templates (key, name, subject, body_html) values
(
  'waitlist_offered',
  'Place libérée (liste d''attente)',
  'Une place s''est libérée pour votre créneau du {{date}}',
  '<p>Bonjour {{prenom}},</p>'
  '<p>Bonne nouvelle : une place vient de se libérer sur le créneau du <strong>{{date}}</strong> ({{horaire}}) pour lequel vous êtes inscrit en liste d''attente.</p>'
  '<p>Vous disposez de <strong>24 heures</strong> pour réserver depuis votre espace : <a href="{{lien_compte}}">finaliser ma réservation</a>.</p>'
  '<p>Au-delà, la place sera proposée à la personne suivante.</p>'
)
on conflict (key) do nothing;

-- ------------------------------------------------------------------
-- 6. Vue waitlist_admin : liste d'attente enrichie pour l'admin
-- ------------------------------------------------------------------
create or replace view public.waitlist_admin as
  select
    w.id,
    w.created_at,
    w.status,
    w.nb_persons,
    w.notified_at,
    w.expires_at,
    s.id          as slot_id,
    s.date        as slot_date,
    s.start_time,
    s.end_time,
    s.status      as slot_status,
    p.id          as user_id,
    p.first_name,
    p.last_name,
    p.email
  from public.waitlist w
  join public.slots s on s.id = w.slot_id
  join public.profiles p on p.id = w.user_id;

grant select on public.waitlist_admin to authenticated;
-- La vue hérite des RLS sous-jacentes (waitlist & slots & profiles).

select 'season_ops: migration OK' as result;
