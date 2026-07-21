-- ============================================================================
-- 0005_column_guards.sql
--
-- RLS grants or denies whole ROWS, never columns. Every policy of the form
-- `using (auth.uid() = owner_id)` therefore hands the owner *every* column in
-- that row -- including privilege and money columns the server actions are
-- careful never to write. Supabase exposes PostgREST directly to any holder of
-- the anon key, so the server action is not the only door to these tables.
--
-- These BEFORE UPDATE triggers close that gap, following the idiom already
-- established by public.prevent_role_escalation() in 0002_functions.sql.
-- Privileged writes remain available to the service-role client (used only by
-- src/lib/admin/actions.ts behind requireAdmin()) and to admins.
-- ============================================================================

-- Shared predicate: is the current caller allowed to write privileged columns?
create or replace function public.is_privileged_writer() returns boolean as $$
  select auth.role() = 'service_role' or public.is_admin(auth.uid());
$$ language sql stable security definer set search_path = public;


-- ---------- PROFESSIONAL PROFILES ----------
-- Guards approval (is_active), trust signals (is_verified, is_featured) and the
-- platform's revenue share (take_rate_bps). Without this a customer can PATCH
-- their own row to go live, self-verify, self-feature and set the fee to zero,
-- which also renders the entire /admin approval flow advisory.
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

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_pro_profile_column_guard on public.professional_profiles;
create trigger trg_pro_profile_column_guard
  before update on public.professional_profiles
  for each row execute function public.guard_professional_profile_columns();


-- ---------- BOOKINGS ----------
-- Snapshotted pricing is documented as immutable in 0001_schema.sql; nothing
-- enforced it. Either party could set total_cents/amount_due_now_cents to 0
-- before paying, or flip status to 'completed' (which additionally satisfies
-- the enforce_review_eligibility trigger).
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


-- ---------- REVIEWS ----------
-- The "reviews respond" policy intends to let a professional write
-- professional_response, but RLS cannot scope to a column: it also allowed them
-- to rewrite rating, blank body, or unpublish criticism -- after which the
-- refresh_professional_rating trigger recomputes the average from the forged
-- values.
create or replace function public.guard_review_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- Publication state is never author-controlled (neither party may bury or
  -- resurrect a review).
  if new.is_published is distinct from old.is_published then
    raise exception 'review publication state is controlled by the platform';
  end if;

  -- The subject of a review may only append their response.
  if auth.uid() = old.professional_id then
    if new.rating      is distinct from old.rating
    or new.body        is distinct from old.body
    or new.customer_id is distinct from old.customer_id
    or new.booking_id  is distinct from old.booking_id then
      raise exception 'a professional may only write professional_response';
    end if;
  end if;

  -- The author may revise their own rating/body, but not answer for the pro.
  if auth.uid() = old.customer_id and auth.uid() is distinct from old.professional_id then
    if new.professional_response is distinct from old.professional_response then
      raise exception 'only the professional may write professional_response';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_review_column_guard on public.reviews;
create trigger trg_review_column_guard
  before update on public.reviews
  for each row execute function public.guard_review_columns();


-- ---------- AVAILABILITY (tighten `using (true)`) ----------
-- 0003_rls.sql:79,82 exposed the full schedules of unapproved, suspended and
-- soft-deleted professionals. Mirrors the portfolio policy from
-- 0004_marketplace.sql:101-110.
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


-- ---------- PROMO CODES ----------
-- `using (is_active)` let anonymous users enumerate every live promo code.
drop policy if exists "promo public read" on public.promo_codes;
create policy "promo read" on public.promo_codes for select
  using (public.is_admin(auth.uid()));
