-- ============================================================================
-- 0026_privileged_writer_hotfix_and_guard_backfill.sql
--
-- ⚠ HOTFIX — apply immediately. Production is currently broken:
--
-- 0005_column_guards.sql was never applied to prod (the repo has TWO files
-- numbered 0005; only 0005_booking_engine.sql ran), while 0015/0023/0025 all
-- built on it. Applying 0025 created triggers trg_profiles_stripe_guard and
-- trg_pro_profile_column_guard whose functions call
-- public.is_privileged_writer() — which does not exist in prod. Result: every
-- non-privileged UPDATE on public.profiles and public.professional_profiles
-- raises 42883 ("function public.is_privileged_writer() does not exist").
-- Mode switching, account settings, and pro profile edits are hard-broken.
--
--   1. Defines is_privileged_writer()          ← the critical one-function fix
--   2. Backfills the never-applied bookings guard (pricing immutability)
--   3. Backfills the reviews guard, UPDATED for 0020 two-way reviews
--   4. Backfills the availability/promo-code policy tightenings from
--      0005_column_guards.sql
--
-- Deliberately does NOT touch guard_professional_profile_columns — the 0025
-- version (approval + moderation + review lifecycle) is current and becomes
-- functional the moment is_privileged_writer() exists.
--
-- ADDITIVE + IDEMPOTENT. Safe to run more than once.
-- ============================================================================

-- ---------- 1. THE MISSING DEPENDENCY (fixes prod immediately) ----------
create or replace function public.is_privileged_writer() returns boolean as $$
  select auth.role() = 'service_role' or public.is_admin(auth.uid());
$$ language sql stable security definer set search_path = public;


-- ---------- 2. BOOKINGS (from 0005_column_guards, unchanged) ----------
-- Snapshotted pricing is documented as immutable in 0001_schema.sql; nothing
-- enforced it. Either party could set total_cents/amount_due_now_cents to 0
-- before paying, or flip status to 'completed'.
create or replace function public.guard_booking_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.subtotal_cents        is distinct from old.subtotal_cents
  or new.addons_cents          is distinct from old.addons_cents
  or new.onsite_upcharge_cents is distinct from old.onsite_upcharge_cents
  or new.fees_cents            is distinct from old.fees_cents
  or new.tax_cents             is distinct from old.tax_cents
  or new.discount_cents        is distinct from old.discount_cents
  or new.tip_cents             is distinct from old.tip_cents
  or new.total_cents           is distinct from old.total_cents
  or new.amount_due_now_cents  is distinct from old.amount_due_now_cents
  or new.platform_fee_cents    is distinct from old.platform_fee_cents
  or new.currency              is distinct from old.currency
  or new.stripe_payment_intent_id is distinct from old.stripe_payment_intent_id
  or new.cancellation_policy_snapshot is distinct from old.cancellation_policy_snapshot
  or new.service_name_snapshot is distinct from old.service_name_snapshot then
    raise exception 'booking pricing is snapshotted and immutable';
  end if;

  -- Settlement states are reached through payment/completion flows on the
  -- server, never by a party PATCHing the row. Cancellation stays available.
  if new.status is distinct from old.status
     and new.status in ('confirmed', 'in_progress', 'completed', 'refunded', 'disputed') then
    raise exception 'booking status % is set by the platform only', new.status;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_booking_column_guard on public.bookings;
create trigger trg_booking_column_guard
  before update on public.bookings
  for each row execute function public.guard_booking_columns();


-- ---------- 3. REVIEWS (0005_column_guards guard, reworked for 0020) ----------
-- 0020 made reviews two-directional (direction + reviewer_id, dimension
-- ratings). The author is reviewer_id (falling back to customer_id for
-- pre-0020 rows). The "reviews respond" policy lets a professional UPDATE a
-- customer_to_pro row, but RLS cannot scope to a column — without this guard
-- they could rewrite the rating or body and the rating-refresh trigger would
-- recompute the average from forged values.
create or replace function public.guard_review_columns() returns trigger as $$
declare
  author uuid := coalesce(old.reviewer_id, old.customer_id);
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- Publication state is never party-controlled (no burying / resurrecting).
  if new.is_published is distinct from old.is_published then
    raise exception 'review publication state is controlled by the platform';
  end if;

  -- Identity / link columns are immutable once written.
  if new.customer_id     is distinct from old.customer_id
  or new.professional_id is distinct from old.professional_id
  or new.booking_id      is distinct from old.booking_id
  or new.reviewer_id     is distinct from old.reviewer_id
  or new.direction       is distinct from old.direction then
    raise exception 'review identity columns are immutable';
  end if;

  -- On a customer->pro review the professional is the subject, not the author:
  -- they may only append their response.
  if old.direction = 'customer_to_pro'
     and auth.uid() = old.professional_id
     and auth.uid() is distinct from author then
    if new.rating                 is distinct from old.rating
    or new.body                   is distinct from old.body
    or new.rating_quality         is distinct from old.rating_quality
    or new.rating_punctuality     is distinct from old.rating_punctuality
    or new.rating_professionalism is distinct from old.rating_professionalism
    or new.rating_communication   is distinct from old.rating_communication
    or new.rating_respectfulness  is distinct from old.rating_respectfulness then
      raise exception 'a professional may only write professional_response';
    end if;
  end if;

  -- professional_response is only meaningful on customer->pro reviews and only
  -- the reviewed professional may write it.
  if new.professional_response is distinct from old.professional_response
     and (old.direction is distinct from 'customer_to_pro'
          or auth.uid() is distinct from old.professional_id) then
    raise exception 'only the reviewed professional may write professional_response';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_review_column_guard on public.reviews;
create trigger trg_review_column_guard
  before update on public.reviews
  for each row execute function public.guard_review_columns();


-- ---------- 4. POLICY TIGHTENINGS (from 0005_column_guards, unchanged) ----------
-- Availability: 0003_rls.sql exposed full schedules of unapproved, suspended
-- and soft-deleted professionals. Mirrors the portfolio policy from 0004.
drop policy if exists "avail rules read" on public.availability_rules;
create policy "avail rules read" on public.availability_rules for select
  using (
    exists (
      select 1 from public.professional_profiles p
      where p.user_id = availability_rules.professional_id
        and (p.is_active or auth.uid() = p.user_id or public.is_admin(auth.uid()))
    )
  );

drop policy if exists "avail exc read" on public.availability_exceptions;
create policy "avail exc read" on public.availability_exceptions for select
  using (
    exists (
      select 1 from public.professional_profiles p
      where p.user_id = availability_exceptions.professional_id
        and (p.is_active or auth.uid() = p.user_id or public.is_admin(auth.uid()))
    )
  );

-- Promo codes: `using (is_active)` let anonymous users enumerate live codes.
drop policy if exists "promo public read" on public.promo_codes;
drop policy if exists "promo read" on public.promo_codes;
create policy "promo read" on public.promo_codes for select
  using (public.is_admin(auth.uid()));
