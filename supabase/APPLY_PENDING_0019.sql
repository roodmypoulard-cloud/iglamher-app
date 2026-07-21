-- iGlamHer — Migration 0019: phone verification flags. Run AFTER 0018. Idempotent.
begin;
alter table public.profiles
  add column if not exists phone_verified boolean not null default false,
  add column if not exists phone_verified_at timestamptz;
commit;
-- Verify (expect 2 rows)
select column_name from information_schema.columns where table_schema='public' and table_name='profiles'
  and column_name in ('phone_verified','phone_verified_at') order by column_name;
