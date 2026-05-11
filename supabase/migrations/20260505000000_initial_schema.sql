-- =====================================================================
-- Baignade Rives d'Paris — Schéma initial
-- Commune de Neuilly-sur-Marne x CONCILIUM
-- =====================================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- =====================================================================
-- ENUMS
-- =====================================================================
create type user_role as enum ('admin', 'manager', 'staff', 'user');

create type slot_status as enum (
  'open',          -- ouvert à la réservation
  'closed',        -- fermé manuellement (météo, maintenance)
  'private',       -- privatisé (groupe, école)
  'archived'       -- archivé (passé)
);

create type reservation_status as enum (
  'pending_payment',
  'confirmed',
  'cancelled',
  'refunded',
  'used',
  'no_show',
  'expired'
);

create type usager_type as enum ('habitant', 'exterieur', 'groupe', 'ecole');

create type scan_result as enum ('valid', 'already_used', 'invalid', 'expired', 'wrong_slot');

-- =====================================================================
-- TABLE: profiles
-- Étend auth.users avec métadonnées applicatives
-- =====================================================================
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name text,
  last_name text,
  phone text,
  role user_role not null default 'user',
  is_resident boolean default false,
  resident_proof_url text,
  notification_email boolean default true,
  notification_sms boolean default false,
  rgpd_consent_at timestamptz,
  marketing_consent boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index idx_profiles_role on public.profiles(role);
create index idx_profiles_email on public.profiles(email);

-- =====================================================================
-- TABLE: slots (créneaux de baignade)
-- Créneaux fixes de 2h, géré par admin/manager
-- =====================================================================
create table public.slots (
  id uuid primary key default uuid_generate_v4(),
  date date not null,
  start_time time not null,
  end_time time not null,
  capacity int not null check (capacity >= 0),
  capacity_residents int default 0 check (capacity_residents >= 0),
  capacity_groups int default 0 check (capacity_groups >= 0),
  price_cents int not null default 500 check (price_cents >= 0),
  price_resident_cents int default 300,
  price_child_cents int default 250,
  status slot_status not null default 'open',
  closure_reason text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references public.profiles(id),
  unique(date, start_time)
);

create index idx_slots_date on public.slots(date);
create index idx_slots_status on public.slots(status);
create index idx_slots_date_status on public.slots(date, status);

-- =====================================================================
-- TABLE: reservations
-- =====================================================================
create table public.reservations (
  id uuid primary key default uuid_generate_v4(),
  reference text not null unique default upper(substring(replace(uuid_generate_v4()::text, '-', '') from 1 for 8)),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_id uuid not null references public.slots(id) on delete restrict,
  status reservation_status not null default 'pending_payment',
  usager_type usager_type default 'exterieur',
  nb_adults int not null default 1 check (nb_adults >= 0),
  nb_children int not null default 0 check (nb_children >= 0),
  total_amount_cents int not null check (total_amount_cents >= 0),
  qr_code_token text unique,
  qr_used_at timestamptz,
  scanned_by uuid references public.profiles(id),
  stripe_session_id text unique,
  stripe_payment_intent text,
  stripe_refund_id text,
  notes text,
  cancelled_at timestamptz,
  cancellation_reason text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  check (nb_adults + nb_children between 1 and 6)
);

create index idx_reservations_user on public.reservations(user_id);
create index idx_reservations_slot on public.reservations(slot_id);
create index idx_reservations_status on public.reservations(status);
create index idx_reservations_qr on public.reservations(qr_code_token);
create index idx_reservations_reference on public.reservations(reference);

-- =====================================================================
-- TABLE: scan_log (historique des scans QR sur site)
-- =====================================================================
create table public.scan_log (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid references public.reservations(id) on delete set null,
  scanned_by uuid references public.profiles(id) on delete set null,
  result scan_result not null,
  scanned_at timestamptz default now(),
  device_info text,
  notes text
);

create index idx_scan_log_reservation on public.scan_log(reservation_id);
create index idx_scan_log_scanned_at on public.scan_log(scanned_at desc);

-- =====================================================================
-- TABLE: waitlist (liste d'attente)
-- =====================================================================
create table public.waitlist (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid not null references public.profiles(id) on delete cascade,
  slot_id uuid not null references public.slots(id) on delete cascade,
  nb_persons int not null default 1,
  status text not null default 'waiting',
  notified_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz default now(),
  unique(user_id, slot_id)
);

create index idx_waitlist_slot on public.waitlist(slot_id);
create index idx_waitlist_status on public.waitlist(status);

-- =====================================================================
-- TABLE: satisfaction_responses
-- =====================================================================
create table public.satisfaction_responses (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid references public.reservations(id) on delete set null,
  user_id uuid references public.profiles(id) on delete set null,
  rating_overall int check (rating_overall between 1 and 5),
  rating_cleanliness int check (rating_cleanliness between 1 and 5),
  rating_staff int check (rating_staff between 1 and 5),
  comment text,
  nps int check (nps between 0 and 10),
  created_at timestamptz default now()
);

create index idx_satisfaction_reservation on public.satisfaction_responses(reservation_id);
create index idx_satisfaction_created on public.satisfaction_responses(created_at desc);

-- =====================================================================
-- TABLE: email_campaigns (communication ciblée)
-- =====================================================================
create table public.email_campaigns (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  subject text not null,
  html_body text not null,
  segment_filter jsonb default '{}',
  status text not null default 'draft', -- draft, sending, sent, failed
  recipients_count int default 0,
  sent_count int default 0,
  failed_count int default 0,
  scheduled_at timestamptz,
  sent_at timestamptz,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now()
);

-- =====================================================================
-- TABLE: notification_log (rappels J-1, H-1, post-visite, etc.)
-- =====================================================================
create table public.notification_log (
  id uuid primary key default uuid_generate_v4(),
  reservation_id uuid references public.reservations(id) on delete cascade,
  user_id uuid references public.profiles(id) on delete cascade,
  channel text not null, -- email, sms
  template text not null, -- confirmation, reminder_j1, reminder_h1, post_visit, cancellation
  status text not null default 'pending', -- pending, sent, failed
  sent_at timestamptz,
  error text,
  created_at timestamptz default now()
);

create index idx_notif_reservation on public.notification_log(reservation_id);
create index idx_notif_status on public.notification_log(status);

-- =====================================================================
-- TABLE: site_settings (config dynamique commune)
-- =====================================================================
create table public.site_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz default now(),
  updated_by uuid references public.profiles(id)
);

-- Valeurs initiales
insert into public.site_settings (key, value) values
  ('site_name', '"Baignade Rives d''Paris"'),
  ('site_open', 'true'),
  ('season_start', '"2026-07-01"'),
  ('season_end', '"2026-08-31"'),
  ('cancellation_deadline_hours', '24'),
  ('refund_policy', '"Remboursement intégral si annulation 24h avant le créneau."'),
  ('contact_email', '"baignade@neuillysurmarne.fr"'),
  ('contact_phone', '"+33 1 43 00 00 00"');

-- =====================================================================
-- VIEWS
-- =====================================================================
create or replace view public.slot_availability as
select
  s.id,
  s.date,
  s.start_time,
  s.end_time,
  s.capacity,
  s.price_cents,
  s.status,
  coalesce(sum(case when r.status in ('confirmed', 'used', 'pending_payment') then r.nb_adults + r.nb_children else 0 end), 0)::int as booked,
  greatest(s.capacity - coalesce(sum(case when r.status in ('confirmed', 'used', 'pending_payment') then r.nb_adults + r.nb_children else 0 end), 0), 0)::int as remaining
from public.slots s
left join public.reservations r on r.slot_id = s.id
group by s.id;

-- =====================================================================
-- FUNCTIONS / TRIGGERS
-- =====================================================================

-- Generic updated_at trigger
create or replace function public.touch_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_profiles_updated before update on public.profiles
  for each row execute function public.touch_updated_at();

create trigger trg_slots_updated before update on public.slots
  for each row execute function public.touch_updated_at();

create trigger trg_reservations_updated before update on public.reservations
  for each row execute function public.touch_updated_at();

-- Auto-create profile on signup
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, first_name, last_name, rgpd_consent_at)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'first_name', ''),
    coalesce(new.raw_user_meta_data->>'last_name', ''),
    now()
  );
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Block overbooking (transactional check)
create or replace function public.check_slot_capacity()
returns trigger as $$
declare
  total_booked int;
  slot_capacity int;
  slot_status_val slot_status;
begin
  select capacity, status into slot_capacity, slot_status_val
  from public.slots where id = new.slot_id for update;

  if slot_status_val <> 'open' then
    raise exception 'Ce créneau n''est pas ouvert à la réservation';
  end if;

  select coalesce(sum(nb_adults + nb_children), 0) into total_booked
  from public.reservations
  where slot_id = new.slot_id
    and status in ('confirmed', 'used', 'pending_payment')
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if total_booked + new.nb_adults + new.nb_children > slot_capacity then
    raise exception 'Capacité du créneau dépassée (% places restantes)', slot_capacity - total_booked;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_reservation_capacity
  before insert on public.reservations
  for each row execute function public.check_slot_capacity();

-- =====================================================================
-- ROW LEVEL SECURITY
-- =====================================================================
alter table public.profiles enable row level security;
alter table public.slots enable row level security;
alter table public.reservations enable row level security;
alter table public.scan_log enable row level security;
alter table public.waitlist enable row level security;
alter table public.satisfaction_responses enable row level security;
alter table public.email_campaigns enable row level security;
alter table public.notification_log enable row level security;
alter table public.site_settings enable row level security;

-- Helper: is admin/manager
create or replace function public.is_staff_or_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager', 'staff')
  );
$$ language sql stable security definer;

create or replace function public.is_admin()
returns boolean as $$
  select exists(
    select 1 from public.profiles
    where id = auth.uid() and role in ('admin', 'manager')
  );
$$ language sql stable security definer;

-- profiles: user voit son profil, admin voit tout
create policy profiles_select_own on public.profiles for select
  using (auth.uid() = id or public.is_admin());
create policy profiles_update_own on public.profiles for update
  using (auth.uid() = id or public.is_admin());
create policy profiles_insert_self on public.profiles for insert
  with check (auth.uid() = id);
create policy profiles_delete_own on public.profiles for delete
  using (auth.uid() = id or public.is_admin());

-- slots: lecture publique des slots ouverts, écriture admin only
create policy slots_select_public on public.slots for select
  using (status in ('open', 'closed') or public.is_admin());
create policy slots_admin_all on public.slots for all
  using (public.is_admin()) with check (public.is_admin());

-- reservations: user voit les siennes, staff/admin voient tout
create policy reservations_select_own on public.reservations for select
  using (auth.uid() = user_id or public.is_staff_or_admin());
create policy reservations_insert_own on public.reservations for insert
  with check (auth.uid() = user_id);
create policy reservations_update_own on public.reservations for update
  using (auth.uid() = user_id or public.is_staff_or_admin());
create policy reservations_admin_delete on public.reservations for delete
  using (public.is_admin());

-- scan_log: staff & admin
create policy scan_log_select_staff on public.scan_log for select
  using (public.is_staff_or_admin());
create policy scan_log_insert_staff on public.scan_log for insert
  with check (public.is_staff_or_admin());

-- waitlist
create policy waitlist_select_own on public.waitlist for select
  using (auth.uid() = user_id or public.is_admin());
create policy waitlist_insert_own on public.waitlist for insert
  with check (auth.uid() = user_id);
create policy waitlist_delete_own on public.waitlist for delete
  using (auth.uid() = user_id or public.is_admin());

-- satisfaction
create policy satisfaction_insert_own on public.satisfaction_responses for insert
  with check (auth.uid() = user_id);
create policy satisfaction_select_own on public.satisfaction_responses for select
  using (auth.uid() = user_id or public.is_admin());

-- campaigns / notification_log / site_settings: admin only (lecture publique de site_settings)
create policy campaigns_admin on public.email_campaigns for all
  using (public.is_admin()) with check (public.is_admin());
create policy notif_admin on public.notification_log for all
  using (public.is_admin()) with check (public.is_admin());

create policy site_settings_select_public on public.site_settings for select using (true);
create policy site_settings_admin on public.site_settings for all
  using (public.is_admin()) with check (public.is_admin());
