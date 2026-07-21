-- Phase 10 — production hardening.
-- 1) Atomic loyalty redemption (removes the read-check-write race / double-spend).
-- 2) Referral audit log for fraud decisions.

-- ---------- atomic loyalty redemption ----------
-- Conditional debit: the UPDATE ... WHERE points >= cost row-locks the account,
-- so two concurrent redemptions can never both succeed — the second sees the
-- already-decremented balance and fails the guard. All three writes commit as
-- one transaction (function body), so credit is only granted if the debit stuck.
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

-- ---------- referral fraud audit log ----------
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
