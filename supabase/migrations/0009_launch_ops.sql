-- ============================================================
-- iGlamHer — 0009 Launch operations
-- Webhook idempotency, platform runtime settings (beta/maintenance/shutdown),
-- Stripe Connect payout fields + earnings ledger, beta access codes.
-- Append-only, safe on fresh/staging/production. No data destruction.
-- ============================================================

-- ---------- webhook idempotency / duplicate-event protection ----------
-- The webhook records every Stripe event id here BEFORE processing side effects.
-- A duplicate/retried event conflicts on the PK and is skipped → exactly-once.
create table if not exists public.stripe_events (
  id           text primary key,          -- Stripe event id (evt_...)
  type         text not null,
  processed_at timestamptz not null default now()
);
alter table public.stripe_events enable row level security;  -- server/service-role only

-- ---------- platform runtime settings (single source of truth) ----------
create table if not exists public.platform_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_by uuid references public.profiles(id),
  updated_at timestamptz not null default now()
);
alter table public.platform_settings enable row level security;
do $$ begin
  create policy "settings public read" on public.platform_settings for select using (true);
exception when duplicate_object then null; end $$;
-- writes via service role (admin actions) only.
insert into public.platform_settings (key, value) values
  ('maintenance_mode', '{"enabled": false, "message": ""}'::jsonb),
  ('bookings_paused',  '{"enabled": false}'::jsonb),
  ('payments_paused',  '{"enabled": false}'::jsonb),
  ('beta',             '{"enabled": false, "invite_only": false, "capacity": null}'::jsonb)
on conflict (key) do nothing;

-- ---------- Stripe Connect payout state on the professional ----------
alter table public.professional_profiles
  add column if not exists connect_details_submitted boolean not null default false,
  add column if not exists connect_charges_enabled   boolean not null default false,
  add column if not exists connect_payouts_enabled   boolean not null default false,
  add column if not exists connect_onboarded_at       timestamptz;

-- ---------- provider earnings ledger (pending → available → paid) ----------
create table if not exists public.earnings_ledger (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  booking_id      uuid references public.bookings(id) on delete set null,
  kind            text not null,          -- earning | refund_adjustment | payout
  amount_cents    integer not null,       -- signed: +earning, -refund/-payout
  status          text not null default 'pending',   -- pending | available | paid
  available_at    timestamptz,
  created_at      timestamptz not null default now(),
  unique (booking_id, kind)               -- one earning/adjustment per booking+kind (idempotent)
);
create index if not exists earnings_pro_idx on public.earnings_ledger (professional_id, status, created_at desc);
alter table public.earnings_ledger enable row level security;
do $$ begin
  create policy "earnings own read" on public.earnings_ledger for select
    using (auth.uid() = professional_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- beta access codes ----------
create table if not exists public.beta_access_codes (
  code        text primary key,
  note        text,
  max_uses    integer not null default 1,
  uses        integer not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);
alter table public.beta_access_codes enable row level security;  -- validated server-side only

create table if not exists public.beta_invites (
  id         uuid primary key default gen_random_uuid(),
  email      text,
  code       text references public.beta_access_codes(code),
  user_id    uuid references public.profiles(id),
  redeemed_at timestamptz,
  created_at timestamptz not null default now()
);
alter table public.beta_invites enable row level security;
do $$ begin
  create policy "beta invite own read" on public.beta_invites for select
    using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
