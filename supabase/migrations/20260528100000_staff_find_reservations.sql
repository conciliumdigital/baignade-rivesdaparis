-- =====================================================================
-- RPC `staff_find_reservations` — recherche par nom côté /staff
-- =====================================================================
-- Améliore l'accessibilité du scanner d'accueil (RGAA 7) : un agent non
-- voyant ou face à un usager sans téléphone peut désormais valider une
-- réservation en tapant le nom plutôt qu'un long code alphanumérique.
--
-- Surface minimale exposée :
--   - SECURITY DEFINER, search_path verrouillé
--   - vérifie auth.uid() + rôle staff/admin/manager (fail-closed sinon)
--   - filtre AUTORITAIREMENT sur les créneaux du jour (Europe/Paris) et
--     les statuts occupants → l'agent ne voit JAMAIS l'historique
--     complet, seulement « qui est attendu aujourd'hui » (minimisation
--     PII, RGPD)
--   - LIMIT 20 résultats (anti-énumération massive)
--   - exige une requête d'au moins 2 caractères (anti-listing par
--     chaîne vide)
--
-- Note : la fonction retourne `qr_code_token` pour permettre à l'agent
-- de finaliser la validation via le flux scan-qr existant (même code
-- path, mêmes contrôles d'autorisation et même journalisation).
-- =====================================================================

create or replace function public.staff_find_reservations(p_query text)
returns table (
  id              uuid,
  reference       text,
  qr_code_token   text,
  first_name      text,
  last_name       text,
  slot_date       date,
  start_time      time,
  end_time        time,
  status          reservation_status,
  nb_adults       int,
  nb_children     int,
  usager_type     usager_type,
  has_proof       boolean
)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_today date;
  v_q     text;
begin
  if auth.uid() is null then
    raise exception 'AUTH_REQUIRED' using errcode = '28000';
  end if;
  if not public.is_staff_or_admin() then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  v_q := btrim(coalesce(p_query, ''));
  if length(v_q) < 2 then
    raise exception 'QUERY_TOO_SHORT' using errcode = 'P0001';
  end if;

  v_today := ((now() at time zone 'Europe/Paris')::date);
  -- Pattern LIKE insensible à la casse (et aux accents si la locale le
  -- permet ; sinon on accepte de manquer quelques résultats accentués
  -- — l'agent peut compléter sa recherche).
  v_q := '%' || lower(v_q) || '%';

  return query
    select
      r.id,
      r.reference,
      r.qr_code_token,
      p.first_name,
      p.last_name,
      s.date,
      s.start_time,
      s.end_time,
      r.status,
      r.nb_adults,
      r.nb_children,
      r.usager_type,
      (r.resident_proof_url is not null) as has_proof
    from public.reservations r
    join public.slots    s on s.id = r.slot_id
    join public.profiles p on p.id = r.user_id
    where s.date = v_today
      and r.status in ('pending_payment','confirmed','used')
      and (
            lower(coalesce(p.first_name,'')) like v_q
         or lower(coalesce(p.last_name,''))  like v_q
         or lower(r.reference)               like v_q
      )
    order by
      -- Les non-utilisées en premier (ce que l'agent veut valider)
      case when r.status = 'used' then 1 else 0 end,
      s.start_time,
      p.last_name nulls last,
      p.first_name nulls last
    limit 20;
end;
$$;

revoke all on function public.staff_find_reservations(text) from public;
grant execute on function public.staff_find_reservations(text) to authenticated;

select 'staff_find_reservations: migration OK' as result;
