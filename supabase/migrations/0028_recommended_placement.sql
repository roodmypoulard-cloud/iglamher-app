-- ============================================================================
-- 0028_recommended_placement.sql — "iGlamHer Recommended" curated placement
--
-- Admin-approved professionals surface in the Recommended section (replaces the
-- Easy Booking chip on Home). Architected as a future PAID placement
-- ($2.99/month, Stripe subscription) but FREE at launch:
--   is_recommended     — the placement flag (admin-only)
--   recommended_at     — when we approved it (audit/history)
--   recommended_until  — NULL = active indefinitely (free era). When billing
--                        ships, the subscription webhook keeps this pushed
--                        forward each period; lapsed payment -> date passes ->
--                        placement drops off automatically. No schema change
--                        needed to turn billing on.
--
-- Additive & idempotent. No data dropped.
-- ============================================================================

alter table public.professional_profiles
  add column if not exists is_recommended    boolean not null default false,
  add column if not exists recommended_at    timestamptz,
  add column if not exists recommended_until timestamptz;

create index if not exists pro_profiles_recommended_idx
  on public.professional_profiles (is_recommended)
  where is_recommended;

-- Extend the column guard: placement is admin/platform-only — a pro must never
-- PATCH themselves into the (soon paid) Recommended shelf. Full latest guard
-- body (0025 rules + the three new columns); create-or-replace supersedes 0025.
create or replace function public.guard_professional_profile_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  -- Approval / trust / revenue columns (0005).
  if new.is_active     is distinct from old.is_active
  or new.is_verified   is distinct from old.is_verified
  or new.is_featured   is distinct from old.is_featured
  or new.take_rate_bps is distinct from old.take_rate_bps then
    raise exception 'approval, verification, featuring and take rate are set by admins only';
  end if;

  -- Recommended placement (0028) — curated now, paid later. Admin/platform only.
  if new.is_recommended    is distinct from old.is_recommended
  or new.recommended_at    is distinct from old.recommended_at
  or new.recommended_until is distinct from old.recommended_until then
    raise exception 'recommended placement is set by the platform only';
  end if;

  -- Account moderation lever (0024).
  if new.account_status is distinct from old.account_status
  or new.banned_at      is distinct from old.banned_at
  or new.banned_by      is distinct from old.banned_by
  or new.ban_reason     is distinct from old.ban_reason
  or new.suspended_at   is distinct from old.suspended_at then
    raise exception 'account moderation state is set by admins only';
  end if;

  -- Application review lifecycle (0023).
  if new.review_status is distinct from old.review_status then
    if not (old.review_status in ('draft', 'needs_more_info')
            and new.review_status = 'pending_review') then
      raise exception 'review status transition % -> % is not permitted', old.review_status, new.review_status;
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_pro_profile_column_guard on public.professional_profiles;
create trigger trg_pro_profile_column_guard
  before update on public.professional_profiles
  for each row execute function public.guard_professional_profile_columns();
