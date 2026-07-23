-- ============================================================================
-- 0030_recommendation_subscriptions.sql — $2.99/mo Featured Recommendations
--
-- One row per professional who has (or had) the paid recommendation
-- subscription. Stripe webhooks are the ONLY writer (service role); the row
-- mirrors Stripe state and drives professional_profiles.recommended_until:
--   trialing/active  -> recommended_until = current_period_end (+ grace)
--   past_due         -> placement expires after the grace window
--   canceled/unpaid  -> placement ends with the paid period
-- Admin free-era placements (no subscription row, recommended_until NULL)
-- are untouched by the sync.
--
-- Additive & idempotent.
-- ============================================================================

create table if not exists public.recommendation_subscriptions (
  professional_id        uuid primary key references public.professional_profiles(user_id) on delete cascade,
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  stripe_price_id        text,
  status                 text not null default 'incomplete' check (status in
                           ('trialing','active','past_due','canceled','unpaid',
                            'incomplete','incomplete_expired','paused')),
  current_period_start   timestamptz,
  current_period_end     timestamptz,
  cancel_at_period_end   boolean not null default false,
  trial_start            timestamptz,
  trial_end              timestamptz,
  last_payment_status    text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index if not exists rec_subs_status_idx on public.recommendation_subscriptions (status);

alter table public.recommendation_subscriptions enable row level security;

-- The professional may see their own subscription; all writes are service-role
-- only (webhook + admin actions) — no insert/update policies on purpose.
do $$ begin
  create policy "rec sub owner read" on public.recommendation_subscriptions for select
    using (auth.uid() = professional_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
