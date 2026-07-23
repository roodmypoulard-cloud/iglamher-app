-- ============================================================================
-- 0025_extend_column_guards.sql
--
-- Extends the BEFORE UPDATE column guards from 0005_column_guards.sql to close
-- three gaps opened by the verification/review + saved-cards work (0022–0024).
-- RLS grants whole ROWS, so any owner who reaches PostgREST directly with the
-- anon key can PATCH columns the server actions never touch. These guards stop:
--
--   1. An applicant PATCHing professional_profiles.account_status back to
--      'active' (un-banning / un-suspending themselves) or clearing ban fields.
--   2. An applicant forging review_status (e.g. -> 'approved' / 'under_review').
--      Only the legitimate self-service transition is allowed:
--        draft | needs_more_info  ->  pending_review
--   3. A user PATCHing profiles.stripe_customer_id /
--      stripe_default_payment_method_id to point at another user's Stripe
--      customer (which would expose/charge their saved cards).
--
-- ADDITIVE + IDEMPOTENT. Privileged writes (service_role client / admins) are
-- unaffected via public.is_privileged_writer(). Depends on 0022 (stripe columns),
-- 0023 (review_status states) and 0024 (account_status + ban/suspend columns);
-- must run after them.
-- ============================================================================

-- ---------- PROFESSIONAL PROFILES (extend the existing guard) ----------
create or replace function public.guard_professional_profile_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- Approval / trust / revenue columns (from 0005).
  if new.is_active     is distinct from old.is_active
  or new.is_verified   is distinct from old.is_verified
  or new.is_featured   is distinct from old.is_featured
  or new.take_rate_bps is distinct from old.take_rate_bps then
    raise exception 'approval, verification, featuring and take rate are set by admins only';
  end if;

  -- Account moderation lever (0024). An owner must never move themselves out of a
  -- 'suspended'/'banned' state, nor forge the ban/suspend audit columns.
  if new.account_status is distinct from old.account_status
  or new.banned_at      is distinct from old.banned_at
  or new.banned_by      is distinct from old.banned_by
  or new.ban_reason     is distinct from old.ban_reason
  or new.suspended_at   is distinct from old.suspended_at then
    raise exception 'account moderation state is set by admins only';
  end if;

  -- Application review lifecycle (0023). Owners may only submit/resubmit for review;
  -- every other review_status transition (approved, under_review, rejected, …) is
  -- admin-only. This keeps /admin approval authoritative, not advisory.
  if new.review_status is distinct from old.review_status then
    if not (old.review_status in ('draft', 'needs_more_info')
            and new.review_status = 'pending_review') then
      raise exception 'review status transition % -> % is not permitted', old.review_status, new.review_status;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

-- Trigger already exists from 0005 (trg_pro_profile_column_guard); create or replace
-- of the function is enough. Re-assert idempotently in case 0005 wasn't applied.
drop trigger if exists trg_pro_profile_column_guard on public.professional_profiles;
create trigger trg_pro_profile_column_guard
  before update on public.professional_profiles
  for each row execute function public.guard_professional_profile_columns();


-- ---------- PROFILES (new guard for Stripe customer columns) ----------
-- These IDs are written server-side only (via the service-role client in
-- src/lib/payments/payment-methods.ts). An owner-session PATCH must never set them.
-- NB: profiles.account_status (0017) is the user's OWN lifecycle (pause/deactivate)
-- and stays self-service — it is intentionally not guarded here.
create or replace function public.guard_profile_stripe_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.stripe_customer_id is distinct from old.stripe_customer_id
  or new.stripe_default_payment_method_id is distinct from old.stripe_default_payment_method_id then
    raise exception 'stripe customer identifiers are set by the platform only';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_profiles_stripe_guard on public.profiles;
create trigger trg_profiles_stripe_guard
  before update on public.profiles
  for each row execute function public.guard_profile_stripe_columns();
