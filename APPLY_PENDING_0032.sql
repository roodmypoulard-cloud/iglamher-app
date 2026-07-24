-- ============================================================================
-- 0032_pro_compliance_licensing.sql — Professional service-location compliance,
-- license metadata, and legal agreement acceptance.
--
-- Extends the existing pro application/verification system (0023/0024) with the
-- pieces a beauty marketplace needs to limit liability:
--   • professional_agreements — immutable proof that a pro accepted the
--     marketplace disclaimer + responsibility certification (timestamp, version,
--     IP, user-agent). This is the legal shield: iGlamHer never claims to have
--     authorized anyone to operate; the pro affirms they carry that burden.
--   • service-location declaration + home-studio compliance answers on the
--     application (jsonb), plus an address-privacy flag.
--   • license metadata columns on professional_documents (number, state,
--     authority, legal name, issue/expiry dates, service category).
--
-- Additive & idempotent. No data dropped. Documents stay in the PRIVATE
-- verification-docs bucket; nothing here exposes them publicly.
-- ============================================================================

-- ---------- 1. Legal agreement acceptance (immutable audit) ----------
create table if not exists public.professional_agreements (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references public.profiles(id) on delete cascade,
  agreement_key  text not null,               -- e.g. 'marketplace_disclaimer', 'license_responsibility'
  version        text not null,               -- bump when the wording changes
  accepted_at    timestamptz not null default now(),
  ip             text,
  user_agent     text,
  metadata       jsonb not null default '{}'::jsonb
);
create index if not exists pro_agreements_user_idx on public.professional_agreements (user_id, agreement_key);

alter table public.professional_agreements enable row level security;
-- Owner may read + insert their OWN acceptance; never update/delete (immutable).
do $$ begin
  create policy "pro agreements owner read" on public.professional_agreements for select
    using (auth.uid() = user_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "pro agreements owner insert" on public.professional_agreements for insert
    with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- 2. Service-location declaration + compliance on the profile ----------
-- service_locations: array of selected location types the pro works from.
-- location_compliance: home-studio Yes/No answers (jsonb) — drives admin review.
-- needs_location_review: set true when a required compliance answer is No.
-- hide_exact_pin: pro chose to hide the exact map pin pre-booking.
alter table public.professional_profiles
  add column if not exists service_locations       jsonb   not null default '[]'::jsonb,
  add column if not exists location_compliance      jsonb   not null default '{}'::jsonb,
  add column if not exists needs_location_review    boolean not null default false,
  add column if not exists hide_exact_pin           boolean not null default true;

-- ---------- 3. License metadata on professional_documents ----------
alter table public.professional_documents
  add column if not exists license_number      text,
  add column if not exists legal_name          text,
  add column if not exists issuing_state       text,
  add column if not exists issuing_authority   text,
  add column if not exists issue_date          date,
  add column if not exists expiration_date     date,
  add column if not exists service_category    text,
  add column if not exists secondary_file_path text;

-- Index for expiration sweeps (renewal reminders, auto-expire).
create index if not exists pro_docs_expiry_idx
  on public.professional_documents (expiration_date)
  where expiration_date is not null;

-- ---------- 4. Guard: pros can't self-set location review/compliance verdicts ----------
-- needs_location_review is an admin/platform signal. Extend the existing
-- professional_profiles column guard (0026 body) with the new admin-only field.
-- (service_locations / location_compliance / hide_exact_pin ARE owner-editable —
-- they're declarations, not verdicts.)
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
