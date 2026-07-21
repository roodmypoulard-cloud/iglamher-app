-- =============================================================================
-- iGlamHer — Combined production migration (0011 + 0012 + 0013)
-- Run ONCE in the Supabase SQL Editor (production).
-- Dependency order: 0011 (loyalty RPC + referral_audit) -> 0012 (payout_transfers)
--                   -> 0013 (messaging RLS recursion fix)
-- Idempotent: safe to re-run. All statements are transactional DDL.
-- Does NOT drop or delete any user/booking/payment/message/payout/loyalty/
-- referral data. The only DROP is on a single broken SELECT *policy*, immediately
-- recreated in a correct, non-recursive form.
-- =============================================================================

-- ============================ SQL TO RUN =====================================
begin;

-- ----------------------------------------------------------------------------
-- 0011 — Phase 10 hardening
-- ----------------------------------------------------------------------------

-- (1) Atomic loyalty redemption. The UPDATE ... WHERE points >= cost row-locks
-- the account, so two concurrent redemptions can never both succeed. security
-- definer + fixed search_path; the function only ever touches p_user's own rows,
-- so it cannot be used to change another user's balance. Callable by service-role
-- only (revoked from anon/authenticated below).
create or replace function public.redeem_loyalty_points(
  p_user uuid,
  p_cost integer,
  p_credit_cents integer
) returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  if p_cost <= 0 or p_credit_cents <= 0 then
    return false;
  end if;

  update public.loyalty_accounts
     set points = points - p_cost,
         updated_at = now()
   where user_id = p_user
     and points >= p_cost
  returning points into v_remaining;

  if not found then
    return false; -- insufficient points (or no account) — nothing changed
  end if;

  insert into public.loyalty_transactions (user_id, points_delta, reason)
    values (p_user, -p_cost, 'redeem');

  insert into public.account_credits (user_id, amount_cents, reason)
    values (p_user, p_credit_cents, 'loyalty_redemption');

  return true;
end;
$$;

revoke all on function public.redeem_loyalty_points(uuid, integer, integer) from public;
-- Only the service-role (server) may invoke it; app calls it via the admin client.
do $$ begin
  revoke all on function public.redeem_loyalty_points(uuid, integer, integer) from anon, authenticated;
exception when undefined_object then null; end $$;

-- (2) Referral fraud audit log.
create table if not exists public.referral_audit (
  id          uuid primary key default gen_random_uuid(),
  referred_id uuid references public.profiles(id) on delete set null,
  referrer_id uuid references public.profiles(id) on delete set null,
  code        text,
  ip          text,
  decision    text not null,                 -- accepted | rejected
  reasons     text[] not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists referral_audit_referrer_idx on public.referral_audit (referrer_id, created_at desc);
create index if not exists referral_audit_ip_idx on public.referral_audit (ip, created_at desc);
alter table public.referral_audit enable row level security;
do $$ begin
  create policy "referral audit admin read" on public.referral_audit for select using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- writes happen via service role (server) only.

-- ----------------------------------------------------------------------------
-- 0012 — Phase 11 Stripe Connect payout ledger
-- ----------------------------------------------------------------------------
create table if not exists public.payout_transfers (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings(id) on delete cascade,
  professional_id    uuid not null references public.professional_profiles(user_id) on delete cascade,
  stripe_transfer_id text unique,
  amount_cents       integer not null check (amount_cents >= 0),
  status             text not null default 'pending',   -- pending | paid | failed | reversed
  failure_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (booking_id)                                    -- exactly one payout per booking
);
create index if not exists payout_transfers_pro_idx on public.payout_transfers (professional_id, created_at desc);
create index if not exists payout_transfers_status_idx on public.payout_transfers (status, created_at desc);

alter table public.payout_transfers enable row level security;
do $$ begin
  create policy "payout_transfers own read" on public.payout_transfers
    for select using (auth.uid() = professional_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- All writes happen via the service-role (server) only — webhook + retry action.

-- ----------------------------------------------------------------------------
-- 0013 — Phase 12 fix infinite recursion (42P17) in messaging RLS
-- ----------------------------------------------------------------------------
-- The old "convo membership read" policy referenced conversation_members inside
-- its own USING clause -> infinite recursion, which propagated to the conversations
-- and messages policies (their subqueries read conversation_members). A member
-- only needs to read their OWN membership rows, so the correct non-recursive
-- policy is simply user_id = auth.uid().
drop policy if exists "convo membership read" on public.conversation_members;

do $$ begin
  create policy "convo membership read" on public.conversation_members
    for select using (user_id = auth.uid());
exception when duplicate_object then null; end $$;

-- Defense-in-depth: guarantee RLS is ON for all messaging tables so anonymous
-- users are denied by default. Idempotent — no-op if already enabled; touches
-- no data and changes no existing policy.
do $$ begin execute 'alter table public.conversation_members enable row level security'; exception when undefined_table then null; end $$;
do $$ begin execute 'alter table public.conversations enable row level security';        exception when undefined_table then null; end $$;
do $$ begin execute 'alter table public.messages enable row level security';             exception when undefined_table then null; end $$;

commit;

-- ========================= VERIFICATION QUERIES ==============================
-- Run this block AFTER the commit above. Read the EXPECTED RESULTS section below.

-- V1) payout_transfers + referral_audit tables exist
select table_name
from information_schema.tables
where table_schema = 'public'
  and table_name in ('payout_transfers', 'referral_audit')
order by table_name;

-- V2) redeem_loyalty_points function exists (and is SECURITY DEFINER)
select p.proname, p.prosecdef as security_definer
from pg_proc p
join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname = 'redeem_loyalty_points';

-- V3) redeem_loyalty_points is NOT executable by anon/authenticated
--     (empty result = correctly locked down to service-role only)
select grantee, privilege_type
from information_schema.routine_privileges
where routine_schema = 'public'
  and routine_name = 'redeem_loyalty_points'
  and grantee in ('anon', 'authenticated');

-- V4) messaging + new policies exist (recursion fix + RLS reads)
select tablename, policyname
from pg_policies
where schemaname = 'public'
  and tablename in ('conversation_members', 'conversations', 'messages',
                    'payout_transfers', 'referral_audit')
order by tablename, policyname;

-- V5) the conversation_members read policy is NON-recursive
--     (its USING clause must NOT mention conversation_members)
select policyname, qual
from pg_policies
where schemaname = 'public'
  and tablename = 'conversation_members'
  and cmd = 'SELECT';

-- V6) RLS is ENABLED on every sensitive table
select relname as table_name, relrowsecurity as rls_enabled
from pg_class
where relnamespace = 'public'::regnamespace
  and relname in ('conversation_members', 'conversations', 'messages',
                  'payout_transfers', 'referral_audit', 'loyalty_accounts')
order by relname;

-- ========================= EXPECTED RESULTS ==================================
-- V1 -> 2 rows: payout_transfers, referral_audit
-- V2 -> 1 row: redeem_loyalty_points, security_definer = true
-- V3 -> 0 rows  (locked to service-role; anon/authenticated cannot execute)
-- V4 -> at minimum:
--        conversation_members | convo membership read
--        payout_transfers     | payout_transfers own read
--        referral_audit       | referral audit admin read
--        (plus existing conversations/messages membership policies, unchanged)
-- V5 -> qual is (user_id = auth.uid()); NO mention of conversation_members
-- V6 -> rls_enabled = true for all six tables
-- =============================================================================
