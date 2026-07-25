-- APPLY ON PROD (after 0035): reschedule support columns. Idempotent.
-- Source of truth: supabase/migrations/0036_reschedule.sql

alter table public.bookings
  add column if not exists change_requested_starts_at timestamptz,
  add column if not exists change_requested_ends_at   timestamptz,
  add column if not exists change_requested_by        uuid references auth.users(id) on delete set null,
  add column if not exists change_note                text;

comment on column public.bookings.change_requested_starts_at is
  'Proposed new start while status = change_requested; applied to starts_at only on acceptance.';
