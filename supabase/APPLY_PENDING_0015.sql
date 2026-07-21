-- =============================================================================
-- iGlamHer — Migration 0015: provider onboarding review state + demo flag
-- Run ONCE in the Supabase SQL Editor (production), AFTER 0011-0014.
-- Additive & idempotent. No data dropped. Does NOT hide demo providers (that is
-- a separate, reversible step: supabase/HIDE_DEMO_PROVIDERS.sql).
-- =============================================================================
begin;

do $$ begin
  create type public.professional_review_status as enum ('draft','pending_review','approved','rejected');
exception when duplicate_object then null; end $$;

alter table public.professional_profiles
  add column if not exists review_status public.professional_review_status not null default 'draft';
alter table public.professional_profiles
  add column if not exists is_demo boolean not null default false;

create index if not exists pro_review_status_idx
  on public.professional_profiles (review_status) where review_status = 'pending_review';

update public.professional_profiles
   set is_demo = true
 where user_id in (
   'a0000000-0000-4000-8000-000000000001','a0000000-0000-4000-8000-000000000002',
   'a0000000-0000-4000-8000-000000000003','a0000000-0000-4000-8000-000000000004',
   'a0000000-0000-4000-8000-000000000005','a0000000-0000-4000-8000-000000000006',
   'a0000000-0000-4000-8000-000000000007','a0000000-0000-4000-8000-000000000008',
   'a0000000-0000-4000-8000-000000000009','a0000000-0000-4000-8000-00000000000a',
   'a0000000-0000-4000-8000-00000000000b','a0000000-0000-4000-8000-00000000000c'
 );

create or replace function public.guard_professional_profile_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;
  if new.is_active     is distinct from old.is_active
  or new.is_verified   is distinct from old.is_verified
  or new.is_featured   is distinct from old.is_featured
  or new.take_rate_bps is distinct from old.take_rate_bps then
    raise exception 'approval, verification, featuring and take rate are set by admins only';
  end if;
  if new.review_status is distinct from old.review_status
     and new.review_status in ('approved','rejected') then
    raise exception 'approval decisions are set by admins only';
  end if;
  if new.is_demo is distinct from old.is_demo then
    raise exception 'demo flag is set by admins only';
  end if;
  return new;
end;
$$ language plpgsql security definer set search_path = public;

commit;

-- ============================ VERIFICATION ===================================
-- V1) columns exist (expect 2 rows: is_demo, review_status)
select column_name from information_schema.columns
where table_schema='public' and table_name='professional_profiles'
  and column_name in ('review_status','is_demo') order by column_name;

-- V2) the 12 demo providers are flagged (expect 12)
select count(*) as demo_flagged from public.professional_profiles where is_demo = true;

-- V3) no real provider accidentally flagged (expect your real pros, is_demo=false)
select count(*) as real_providers from public.professional_profiles where is_demo = false;
-- =============================================================================
