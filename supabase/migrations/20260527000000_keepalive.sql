-- =====================================================================
-- ANTI-PAUSE SUPABASE : battement de cœur (heartbeat) en écriture
-- =====================================================================
-- Le timer d'inactivité 7 jours du Free tier se base sur l'ACTIVITÉ
-- BASE DE DONNÉES (requêtes/écritures réelles), PAS sur les hits du
-- gateway REST/Auth. Un simple `select` (lecture) sur une vue ne suffit
-- PAS : le job keep-alive a renvoyé HTTP 200 dix jours d'affilée et le
-- mail « projet bientôt mis en pause » est quand même arrivé.
--
-- Solution : une fonction RPC appelable par `anon` qui fait une vraie
-- ÉCRITURE (UPSERT) dans une table dédiée. Le workflow GitHub Actions
-- appelle `POST /rest/v1/rpc/keepalive` → écriture réelle → activité
-- comptabilisée par Supabase.
--
-- Sécurité :
--  - Table à ligne unique (id=1) : un appel anon ne fait qu'UPSERT la
--    même ligne, la table ne grossit JAMAIS (pas de vecteur d'abus).
--  - RLS activée SANS policy : aucun accès direct anon/authenticated à
--    la table. Seule la fonction SECURITY DEFINER (search_path verrouillé)
--    y écrit. Aucune donnée métier exposée.
-- Idempotent.
-- =====================================================================

-- ---------------------------------------------------------------------
-- Table heartbeat (ligne unique, bornée)
-- ---------------------------------------------------------------------
create table if not exists public.keepalive_heartbeat (
  id         smallint primary key default 1,
  last_ping  timestamptz not null default now(),
  ping_count bigint not null default 0,
  constraint keepalive_singleton check (id = 1)
);

alter table public.keepalive_heartbeat enable row level security;

-- Aucune policy → table inaccessible directement. Révoque tout privilège
-- direct : seule la fonction definer ci-dessous peut écrire.
revoke all on table public.keepalive_heartbeat from anon, authenticated;

-- ---------------------------------------------------------------------
-- RPC keepalive() : UPSERT de la ligne unique → écriture réelle
-- ---------------------------------------------------------------------
create or replace function public.keepalive()
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_ts timestamptz;
begin
  insert into public.keepalive_heartbeat (id, last_ping, ping_count)
  values (1, now(), 1)
  on conflict (id) do update
    set last_ping  = now(),
        ping_count = public.keepalive_heartbeat.ping_count + 1
  returning last_ping into v_ts;
  return v_ts;
end;
$$;

-- Exécutable par le job keep-alive (clé anon) et les usagers connectés.
revoke all on function public.keepalive() from public;
grant execute on function public.keepalive() to anon, authenticated;

-- ---------------------------------------------------------------------
-- Contrôle rapide
-- ---------------------------------------------------------------------
select public.keepalive() as heartbeat_ok;
