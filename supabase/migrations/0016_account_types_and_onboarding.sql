-- Phase 14 — role-based accounts (customer / professional / both) + dual mode.
--
-- ONE account supports both customer and professional use. `role` stays the
-- existing gate for pro-dashboard access (professional for professional/both);
-- `account_type` drives onboarding + the mode switcher; `active_mode` is the
-- currently-shown UI mode and persists across sessions. Customer features are
-- auth-gated (not role-gated), so a professional can always book, satisfying
-- "do not block professionals from using customer features".
--
-- Additive & idempotent. No data dropped. Extends the existing auth system.

-- ---------- enums ----------
do $$ begin create type public.account_type as enum ('customer','professional','both');
exception when duplicate_object then null; end $$;
do $$ begin create type public.account_mode as enum ('customer','professional');
exception when duplicate_object then null; end $$;

-- ---------- profiles: names, account type, mode, onboarding flags ----------
alter table public.profiles
  add column if not exists first_name text,
  add column if not exists last_name  text,
  add column if not exists account_type public.account_type not null default 'customer',
  add column if not exists active_mode  public.account_mode not null default 'customer',
  add column if not exists customer_onboarding_completed     boolean not null default false,
  add column if not exists professional_onboarding_completed boolean not null default false,
  add column if not exists onboarding_completed              boolean not null default false;

create index if not exists profiles_account_type_idx on public.profiles (account_type);

-- ---------- professional categories (Hair Stylist, Braider, ... Other) ----------
create table if not exists public.professional_categories (
  id         uuid primary key default gen_random_uuid(),
  slug       text unique not null,
  label      text not null,
  sort_order integer not null default 0
);
insert into public.professional_categories (slug, label, sort_order) values
  ('hair_stylist','Hair Stylist',10), ('braider','Braider',20), ('barber','Barber',30),
  ('makeup_artist','Makeup Artist',40), ('nail_technician','Nail Technician',50),
  ('lash_technician','Lash Technician',60), ('brow_artist','Brow Artist',70),
  ('esthetician','Esthetician',80), ('skincare_specialist','Skincare Specialist',90),
  ('waxing_specialist','Waxing Specialist',100), ('massage_therapist','Massage Therapist',110),
  ('other','Other',120)
on conflict (slug) do nothing;

create table if not exists public.professional_category_assignments (
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  category_id     uuid not null references public.professional_categories(id) on delete cascade,
  created_at      timestamptz not null default now(),
  primary key (professional_id, category_id)
);
create index if not exists pro_cat_assign_pro_idx on public.professional_category_assignments (professional_id);

-- ---------- blocked / vacation dates ----------
create table if not exists public.blocked_dates (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  start_date      date not null,
  end_date        date not null,
  kind            text not null default 'blocked',   -- blocked | vacation
  reason          text,
  created_at      timestamptz not null default now(),
  check (end_date >= start_date)
);
create index if not exists blocked_dates_pro_idx on public.blocked_dates (professional_id, start_date);

-- ---------- notification preferences ----------
create table if not exists public.notification_preferences (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  email      boolean not null default true,
  sms        boolean not null default true,
  push       boolean not null default true,
  updated_at timestamptz not null default now()
);

-- ---------- RLS ----------
alter table public.professional_categories          enable row level security;
alter table public.professional_category_assignments enable row level security;
alter table public.blocked_dates                    enable row level security;
alter table public.notification_preferences         enable row level security;

-- categories are public read (taxonomy); writes are service-role only
do $$ begin
  create policy "pro categories public read" on public.professional_categories for select using (true);
exception when duplicate_object then null; end $$;

-- category assignments: public read (needed on public profile), owner writes
do $$ begin
  create policy "cat assign public read" on public.professional_category_assignments for select using (true);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "cat assign owner write" on public.professional_category_assignments
    for all using (auth.uid() = professional_id) with check (auth.uid() = professional_id);
exception when duplicate_object then null; end $$;

-- blocked dates: owner-only (private scheduling data)
do $$ begin
  create policy "blocked dates owner" on public.blocked_dates
    for all using (auth.uid() = professional_id) with check (auth.uid() = professional_id);
exception when duplicate_object then null; end $$;

-- notification preferences: owner-only
do $$ begin
  create policy "notif prefs owner" on public.notification_preferences
    for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
