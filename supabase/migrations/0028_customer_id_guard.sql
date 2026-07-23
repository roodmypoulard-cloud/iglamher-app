-- ============================================================================
-- 0028_customer_id_guard.sql
--
-- Customer ID verification (KYC-lite). The columns already exist from
-- 0006_trust_safety.sql (customer_profiles.is_id_verified /
-- verification_status / id_document_url / selfie_url), but RLS "customer own"
-- grants the owner the whole ROW — so any customer hitting PostgREST directly
-- with the anon key could set is_id_verified=true or
-- verification_status='approved' and award themselves the verified badge.
--
-- Follows the 0026 guard idiom (is_privileged_writer from 0026). Owner may
-- only submit/resubmit: unsubmitted | rejected -> pending. The verdict
-- (approved/rejected, is_id_verified) is admin/service-role only, as are the
-- trust/moderation columns.
--
-- ADDITIVE + IDEMPOTENT. Depends on 0026 (is_privileged_writer).
-- ============================================================================

create or replace function public.guard_customer_profile_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- The verification verdict is never self-service.
  if new.is_id_verified is distinct from old.is_id_verified then
    raise exception 'identity verification is set by admins only';
  end if;

  if new.verification_status is distinct from old.verification_status then
    if not (old.verification_status in ('unsubmitted', 'rejected')
            and new.verification_status = 'pending') then
      raise exception 'verification status transition % -> % is not permitted',
        old.verification_status, new.verification_status;
    end if;
  end if;

  -- Trust / moderation levers stay with the platform.
  if new.reliability_score is distinct from old.reliability_score
  or new.cancellation_rate is distinct from old.cancellation_rate
  or new.is_frozen         is distinct from old.is_frozen then
    raise exception 'trust and moderation columns are set by the platform only';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_customer_profile_column_guard on public.customer_profiles;
create trigger trg_customer_profile_column_guard
  before update on public.customer_profiles
  for each row execute function public.guard_customer_profile_columns();

-- INSERT path: "customer own" is FOR ALL, so a first-time PostgREST INSERT could
-- otherwise seed the row already-verified.
create or replace function public.guard_customer_profile_insert() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.is_id_verified
     or new.verification_status not in ('unsubmitted', 'pending') then
    raise exception 'identity verification is set by admins only';
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_customer_profile_insert_guard on public.customer_profiles;
create trigger trg_customer_profile_insert_guard
  before insert on public.customer_profiles
  for each row execute function public.guard_customer_profile_insert();
