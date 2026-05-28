-- =====================================================================
-- CORRECTIONS D'AUDIT — sécurité, intégrité fonctionnelle, anti-pause
-- (audit interne v1.3.5 → corrections v1.4.0)
-- =====================================================================
--
-- 1. SÉCURITÉ — `set search_path = public, pg_temp` sur TOUTES les
--    fonctions SECURITY DEFINER existantes (parade contre l'escalade
--    par shadowing de schéma — déjà signalé par le linter Supabase).
--
-- 2. RPC `cancel_reservation()` : annulation côté serveur, comparaison
--    deadline en Europe/Paris, libération du créneau via le trigger
--    existant `notify_on_reservation_freed` (qui notifie aussi la liste
--    d'attente). Remplace l'`update status='cancelled'` côté client
--    qui ne re-vérifiait pas le délai et causait des bugs de fuseau.
--
-- 3. Rate-limit doux sur `keepalive()` : early-return si dernier ping
--    < 30 s, pour neutraliser un éventuel martelage anon (la table est
--    déjà bornée à une ligne, mais on évite le bruit WAL).
--
-- Idempotent — peut être réappliqué sans effet de bord.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Verrouillage search_path des fonctions SECURITY DEFINER existantes
-- ---------------------------------------------------------------------
-- Pourquoi : un attaquant capable de créer un objet (table, fonction)
-- dans un schéma précédant `public` dans le search_path peut ainsi
-- détourner l'appel (ex. fake `profiles` retournant role='admin' pour
-- `is_admin()`). Forcer `search_path = public, pg_temp` neutralise.
-- ---------------------------------------------------------------------

alter function public.handle_new_user()                       set search_path = public, pg_temp;
alter function public.is_admin()                              set search_path = public, pg_temp;
alter function public.is_staff_or_admin()                     set search_path = public, pg_temp;
alter function public.prevent_privilege_self_escalation()     set search_path = public, pg_temp;
alter function public.secure_reservation_insert()             set search_path = public, pg_temp;
alter function public.secure_reservation_update()             set search_path = public, pg_temp;
alter function public.redeem_discount_after_insert()          set search_path = public, pg_temp;

-- `check_slot_capacity` et `touch_updated_at` ne sont pas SECURITY DEFINER
-- mais on verrouille par hygiène (zéro coût, défense en profondeur).
alter function public.check_slot_capacity()                   set search_path = public, pg_temp;
alter function public.touch_updated_at()                      set search_path = public, pg_temp;

-- ---------------------------------------------------------------------
-- 2. RPC cancel_reservation() — annulation serveur
-- ---------------------------------------------------------------------
-- Règles :
--   - auth requise (anon refusé)
--   - propriétaire OU staff/admin
--   - statut courant ∈ {pending_payment, confirmed}
--   - créneau strictement futur (toute annulation d'un créneau passé
--     refusée côté usager ; staff/admin peuvent forcer)
--   - délai > `cancellation_deadline_hours` (lu depuis site_settings,
--     défaut 24h) — calcul en Europe/Paris pour cohérence (le créneau
--     est exprimé en heure locale)
--   - update status='cancelled' déclenche le trigger
--     `notify_on_reservation_freed` qui notifie la liste d'attente
-- ---------------------------------------------------------------------

create or replace function public.cancel_reservation(
  p_reservation_id uuid,
  p_reason         text default null
)
returns void
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_user_id        uuid := auth.uid();
  v_is_staff       boolean := public.is_staff_or_admin();
  v_res            public.reservations%rowtype;
  v_slot_date      date;
  v_slot_start     time;
  v_starts_at      timestamptz;
  v_deadline_hours int;
begin
  if v_user_id is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;

  select * into v_res from public.reservations
    where id = p_reservation_id
    for update;

  if not found then
    raise exception 'RESERVATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_res.user_id <> v_user_id and not v_is_staff then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if v_res.status not in ('pending_payment','confirmed') then
    raise exception 'RESERVATION_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  select s.date, s.start_time into v_slot_date, v_slot_start
    from public.slots s where s.id = v_res.slot_id;

  -- Heure d'ouverture du créneau interprétée en Europe/Paris
  v_starts_at := (v_slot_date + v_slot_start) at time zone 'Europe/Paris';

  -- Délai de rétractation (paramétrable, défaut 24h)
  select coalesce((value::text)::int, 24) into v_deadline_hours
    from public.site_settings where key = 'cancellation_deadline_hours';
  v_deadline_hours := coalesce(v_deadline_hours, 24);

  if not v_is_staff then
    if v_starts_at <= now() then
      raise exception 'SLOT_IN_PAST' using errcode = 'P0001';
    end if;
    if v_starts_at - now() < make_interval(hours => v_deadline_hours) then
      raise exception 'CANCELLATION_DEADLINE_PASSED' using errcode = 'P0001';
    end if;
  end if;

  update public.reservations
     set status              = 'cancelled',
         cancelled_at        = now(),
         cancellation_reason = nullif(btrim(coalesce(p_reason, '')), '')
   where id = p_reservation_id;
end;
$$;

revoke all on function public.cancel_reservation(uuid, text) from public;
grant execute on function public.cancel_reservation(uuid, text) to authenticated;

-- ---------------------------------------------------------------------
-- 3. Rate-limit doux sur keepalive()
-- ---------------------------------------------------------------------
-- Si quelqu'un martèle la RPC, on absorbe sans écrire (last_ping est
-- retourné sans UPSERT). Le job GitHub Actions tourne 2×/jour donc
-- jamais dans la fenêtre de 30 s — aucune régression keep-alive.
-- ---------------------------------------------------------------------

create or replace function public.keepalive()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ts        timestamptz;
  v_last_ping timestamptz;
begin
  select last_ping into v_last_ping
    from public.keepalive_heartbeat where id = 1;

  if v_last_ping is not null and now() - v_last_ping < interval '30 seconds' then
    return v_last_ping;  -- absorbe le bruit, pas d'écriture
  end if;

  insert into public.keepalive_heartbeat (id, last_ping, ping_count)
  values (1, now(), 1)
  on conflict (id) do update
    set last_ping  = now(),
        ping_count = public.keepalive_heartbeat.ping_count + 1
  returning last_ping into v_ts;
  return v_ts;
end;
$$;

revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Contrôle rapide
-- ---------------------------------------------------------------------
select 'audit_fixes' as ok, public.keepalive() as heartbeat;
