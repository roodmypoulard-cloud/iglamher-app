-- 0033 — Labeled verification badges + address privacy
--
-- C4: `is_verified` was a single flag that the UI rendered as "Verified by
-- iGlamHer — identity and professional information reviewed", which overclaims.
-- Split it into per-credential, admin-approved facts. Pros can never self-award
-- any of these: they are written by the admin review flow only (column guard).
--
-- C3: `neighborhood` gives customers a truthful pre-booking location without
-- exposing `studio_address`. Only the neighborhood/city is customer-visible
-- before a booking is confirmed; the exact address unlocks after confirmation.

-- ---------- 1. Per-credential verification state (admin-only) ----------
alter table public.professional_profiles
  add column if not exists identity_verified        boolean not null default false,
  add column if not exists license_verified         boolean not null default false,
  add column if not exists insurance_verified       boolean not null default false,
  add column if not exists home_studio_reviewed     boolean not null default false,
  add column if not exists salon_location_verified  boolean not null default false;

comment on column public.professional_profiles.identity_verified is
  'Admin verified a government ID document. Never self-set.';
comment on column public.professional_profiles.license_verified is
  'Admin verified a professional license/credential document. Never self-set.';
comment on column public.professional_profiles.insurance_verified is
  'Admin verified a liability insurance document. Never self-set.';
comment on column public.professional_profiles.home_studio_reviewed is
  'Admin reviewed the home-studio compliance answers. Not a permit or approval to operate.';
comment on column public.professional_profiles.salon_location_verified is
  'Admin verified the salon / commercial location. Never self-set.';

-- Backfill: an already-approved pro had a verified ID + credential checked by an
-- admin (that is what unmetApprovalRequirements gates approval on), so those two
-- facts carry over. Insurance / home-studio / salon are NOT backfilled — nobody
-- ever reviewed them, and inventing them is exactly the overclaim we're fixing.
update public.professional_profiles
   set identity_verified = true,
       license_verified  = true
 where is_verified = true
   and identity_verified = false;

-- ---------- 2. Address privacy ----------
alter table public.professional_profiles
  add column if not exists neighborhood text;

comment on column public.professional_profiles.neighborhood is
  'Customer-visible approximate area (e.g. "West Hollywood"). Safe to show pre-booking; studio_address is not.';
comment on column public.professional_profiles.studio_address is
  'Exact street address. Customer-visible ONLY after a booking is confirmed and paid, or when hide_exact_pin is false. Admins always see it.';

-- ---------- 3. Guard: badges are admin verdicts, not pro declarations ----------
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

  -- 0033: labeled verification badges are admin verdicts. A pro who could set
  -- these could award themselves "Licensed" or "Insured" without review.
  if new.identity_verified       is distinct from old.identity_verified
  or new.license_verified        is distinct from old.license_verified
  or new.insurance_verified      is distinct from old.insurance_verified
  or new.home_studio_reviewed    is distinct from old.home_studio_reviewed
  or new.salon_location_verified is distinct from old.salon_location_verified then
    raise exception 'verification badges are set by admins only';
  end if;

  if new.is_recommended    is distinct from old.is_recommended
  or new.recommended_at    is distinct from old.recommended_at
  or new.recommended_until is distinct from old.recommended_until then
    raise exception 'recommended placement is set by the platform only';
  end if;

  if new.needs_location_review is distinct from old.needs_location_review then
    raise exception 'location review status is set by the platform only';
  end if;

  if new.account_status is distinct from old.account_status
  or new.banned_at      is distinct from old.banned_at
  or new.banned_by      is distinct from old.banned_by
  or new.ban_reason     is distinct from old.ban_reason
  or new.suspended_at   is distinct from old.suspended_at then
    raise exception 'account moderation state is set by admins only';
  end if;

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
