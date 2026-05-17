-- =====================================================================
-- Tarif habitant Neuilly-sur-Marne :
-- - Choix habitant / extérieur lors de la réservation
-- - Si habitant : upload d'un justificatif + déclaration sur l'honneur
-- - Admin + staff consultent le justificatif (URL signée)
-- =====================================================================

-- 1) Colonnes sur reservations
alter table public.reservations
  add column if not exists resident_proof_url text,
  add column if not exists honor_certification boolean not null default false;

-- 2) Vue slot_availability : exposer le tarif habitant
-- IMPORTANT : `create or replace view` n'autorise QUE l'ajout de colonnes
-- en fin de liste (PG erreur 42P16 sinon). price_resident_cents est donc
-- ajouté APRÈS booked/remaining, sans toucher à l'ordre existant. Le front
-- lit par nom (select *), l'ordre des colonnes est sans impact.
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
  greatest(s.capacity - coalesce(sum(case when r.status in ('confirmed', 'used', 'pending_payment') then r.nb_adults + r.nb_children else 0 end), 0), 0)::int as remaining,
  s.price_resident_cents
from public.slots s
left join public.reservations r on r.slot_id = s.id
group by s.id;

-- 3) Storage bucket pour les justificatifs (privé, accès via URL signée)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'resident-proofs',
  'resident-proofs',
  false,
  5242880, -- 5 MB
  array['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
on conflict (id) do update set
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

-- 4) RLS sur storage.objects pour ce bucket
-- Chemin attendu : <user_id>/<reservation_id>.<ext>

drop policy if exists "resident_proofs_insert_own" on storage.objects;
create policy "resident_proofs_insert_own"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'resident-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resident_proofs_select_own_or_staff" on storage.objects;
create policy "resident_proofs_select_own_or_staff"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'resident-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_staff_or_admin()
    )
  );

drop policy if exists "resident_proofs_update_own" on storage.objects;
create policy "resident_proofs_update_own"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'resident-proofs'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists "resident_proofs_delete_own_or_admin" on storage.objects;
create policy "resident_proofs_delete_own_or_admin"
  on storage.objects for delete
  to authenticated
  using (
    bucket_id = 'resident-proofs'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );
