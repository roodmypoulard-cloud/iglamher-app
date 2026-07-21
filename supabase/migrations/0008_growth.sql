-- ============================================================
-- iGlamHer — 0008 Growth engine
-- Loyalty (iGlam Rewards), referrals, marketing campaigns, analytics events,
-- account credits. Append-only: assumes 0001–0007 applied.
-- ============================================================

-- ---------- analytics events (server-side event log for the funnel) ----------
create table if not exists public.analytics_events (
  id         bigint generated always as identity primary key,
  user_id    uuid references public.profiles(id) on delete set null,
  event      text not null,
  props      jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_events_event_idx on public.analytics_events (event, created_at desc);
create index if not exists analytics_events_user_idx  on public.analytics_events (user_id, created_at desc);
alter table public.analytics_events enable row level security;
do $$ begin
  create policy "analytics insert self" on public.analytics_events for insert
    with check (user_id is null or auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "analytics admin read" on public.analytics_events for select using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- loyalty (iGlam Rewards) ----------
create table if not exists public.loyalty_accounts (
  user_id         uuid primary key references public.profiles(id) on delete cascade,
  points          integer not null default 0 check (points >= 0),
  lifetime_points integer not null default 0 check (lifetime_points >= 0),
  tier            text not null default 'bronze',
  updated_at      timestamptz not null default now()
);
create table if not exists public.loyalty_transactions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  points_delta integer not null,
  reason       text not null,        -- earn_booking | milestone | birthday | redeem | referral
  booking_id   uuid references public.bookings(id) on delete set null,
  created_at   timestamptz not null default now()
);
create index if not exists loyalty_tx_user_idx on public.loyalty_transactions (user_id, created_at desc);
alter table public.loyalty_accounts enable row level security;
alter table public.loyalty_transactions enable row level security;
do $$ begin
  create policy "loyalty acct own read" on public.loyalty_accounts for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "loyalty tx own read" on public.loyalty_transactions for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- writes happen via service role (server) only.

-- ---------- account credits (referral rewards, redemptions, goodwill) ----------
create table if not exists public.account_credits (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  amount_cents integer not null,          -- positive = credit granted, negative = spent
  reason      text not null,
  created_at  timestamptz not null default now()
);
create index if not exists account_credits_user_idx on public.account_credits (user_id, created_at desc);
alter table public.account_credits enable row level security;
do $$ begin
  create policy "credits own read" on public.account_credits for select using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- referrals ----------
create table if not exists public.referral_codes (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  code       text unique not null,
  kind       text not null default 'customer',   -- customer | professional
  created_at timestamptz not null default now()
);
create index if not exists referral_codes_code_idx on public.referral_codes (code);
create table if not exists public.referrals (
  id          uuid primary key default gen_random_uuid(),
  referrer_id uuid not null references public.profiles(id) on delete cascade,
  referred_id uuid not null references public.profiles(id) on delete cascade,
  code        text not null,
  kind        text not null default 'customer',
  status      text not null default 'pending',   -- pending | qualified | rewarded | rejected
  rewarded_at timestamptz,
  created_at  timestamptz not null default now(),
  unique (referred_id)                            -- a user can only be referred once
);
create index if not exists referrals_referrer_idx on public.referrals (referrer_id, created_at desc);
alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
do $$ begin
  create policy "referral code own" on public.referral_codes for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "referrals party read" on public.referrals for select
    using (auth.uid() = referrer_id or auth.uid() = referred_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- marketing campaigns ----------
create table if not exists public.campaigns (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  type          text not null,                -- coupon | seasonal | geo | abandoned_booking | influencer
  discount_type text not null,                -- percent | fixed
  discount_value integer not null,
  is_active     boolean not null default true,
  starts_at     timestamptz,
  ends_at       timestamptz,
  cities        text[] not null default '{}',
  min_subtotal_cents integer,
  ab_treatment_fraction numeric(4,3),
  created_by    uuid references public.profiles(id),
  created_at    timestamptz not null default now()
);
create index if not exists campaigns_active_idx on public.campaigns (is_active) where is_active;
create table if not exists public.campaign_redemptions (
  id          uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  booking_id  uuid references public.bookings(id) on delete set null,
  discount_cents integer not null,
  created_at  timestamptz not null default now()
);
create index if not exists campaign_redemptions_campaign_idx on public.campaign_redemptions (campaign_id);
alter table public.campaigns enable row level security;
alter table public.campaign_redemptions enable row level security;
do $$ begin
  create policy "campaigns public read active" on public.campaigns for select
    using (is_active or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "campaign redemptions own read" on public.campaign_redemptions for select
    using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
