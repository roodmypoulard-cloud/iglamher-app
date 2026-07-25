-- 0036: Reschedule (change_requested) support. The status machine has allowed
-- confirmed <-> change_requested since 0001; these columns store WHAT change is
-- proposed and by whom, so the other party can accept or decline it.
-- Idempotent, safe on fresh/staging/prod.

alter table public.bookings
  add column if not exists change_requested_starts_at timestamptz,
  add column if not exists change_requested_ends_at   timestamptz,
  add column if not exists change_requested_by        uuid references auth.users(id) on delete set null,
  add column if not exists change_note                text;

comment on column public.bookings.change_requested_starts_at is
  'Proposed new start while status = change_requested; applied to starts_at only on acceptance.';
