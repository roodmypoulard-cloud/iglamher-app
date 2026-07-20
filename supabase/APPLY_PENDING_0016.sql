-- =============================================================================
-- iGlamHer — Migration 0016: account types (customer/professional/both) + onboarding
-- Run ONCE in the Supabase SQL Editor, AFTER 0011-0015. Additive & idempotent.
-- No data dropped. Foundation for role-based signup, dual-mode, and pro onboarding.
-- (Paste the full body of supabase/migrations/0016_account_types_and_onboarding.sql,
--  wrapped in begin/commit below, then run the verification queries.)
-- =============================================================================
begin;

do $$ begin create type public.account_type as enum ('customer','professional','both');
exception when duplicate_object then null; end $$;
do $$ begin create type public.account_mode as enum ('customer','professional');
exception when duplicate_object then null; end $$;

alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists account_type public.account_type not null default 'customer',
  add column if not exists active_mode  public.account_mode not null default 'customer',
  add column if not exists customer_onboarding_completed     boolean not null default false,
  add column if not exists professional_onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed              boolean not null default false;
create index if not exists profiles_account_type_idx on public.profiles (account_type);

create table if not exists public.professional_categories (
  id uuid primary key default gen_random_uuid(), slug text unique not null, label text not null, sort_order integer not null default 0);
insert into public.professional_categories (slug, label, sort_order) values
  ('hair_stylist','Hair Stylist',10), ('braider','Braider',20), ('barber','Barber',30),
  ('makeup_artist','Makeup Artist',40), ('nail_technician','Nail Technician',50),
  ('lash_technician','Lash Technician',60), ('brow_artist','Brow Artist',70),
  ('esthetician','Esthetician',80), ('skincare_specialist','Skincare Specialist',90),
  ('waxing_specialist','Waxing Specialist',100), ('massage_therapist','Massage Therapist',110), ('other','Other',120)
on conflict (slug) do nothing;

create table if not exists public.professional_category_assignments (
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  category_id uuid not null references public.professional_categories(id) on delete cascade,
  created_at timestamptz not null default now(), primary key (professional_id, category_id));
create index if not exists pro_cat_assign_pro_idx on public.professional_category_assignments (professional_id);

create table if not exists public.blocked_dates (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  start_date date not null, end_date date not null, kind text not null default 'blocked', reason text,
  created_at timestamptz not null default now(), check (end_date >= start_date));
create index if not exists blocked_dates_pro_idx on public.blocked_dates (professional_id, start_date);

create table if not exists public.notification_preferences (
  user_id uuid primary key references public.profiles(id) on delete cascade,
  email boolean not null default true, sms boolean not null default true, push boolean not null default true,
  updated_at timestamptz not null default now());

alter table public.professional_categories           enable row level security;
alter table public.professional_category_assignments enable row level security;
alter table public.blocked_dates                     enable row level security;
alter table public.notification_preferences          enable row level security;

do $$ begin create policy "pro categories public read" on public.professional_categories for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "cat assign public read" on public.professional_category_assignments for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin create policy "cat assign owner write" on public.professional_category_assignments
  for all using (auth.uid() = professional_id) with check (auth.uid() = professional_id);
exception when duplicate_object then null; end $$;
do $$ begin create policy "blocked dates owner" on public.blocked_dates
  for all using (auth.uid() = professional_id) with check (auth.uid() = professional_id);
exception when duplicate_object then null; end $$;
do $$ begin create policy "notif prefs owner" on public.notification_preferences
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

commit;

-- ============================ VERIFICATION ===================================
-- V1) profiles has the 7 new columns (expect 7 rows)
select column_name from information_schema.columns where table_schema='public' and table_name='profiles'
  and column_name in ('first_name','last_name','account_type','active_mode',
    'customer_onboarding_completed','professional_onboarding_completed','onboarding_completed')
  order by column_name;
-- V2) 12 professional categories seeded
select count(*) as pro_categories from public.professional_categories;
-- V3) new tables exist (expect 4)
select table_name from information_schema.tables where table_schema='public'
  and table_name in ('professional_categories','professional_category_assignments','blocked_dates','notification_preferences')
  order by table_name;
-- Expected: V1 -> 7 rows, V2 -> 12, V3 -> 4 rows.
