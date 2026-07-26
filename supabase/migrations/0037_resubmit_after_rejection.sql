-- ============================================================================
-- 0037_resubmit_after_rejection.sql
--
-- Allow a REJECTED professional to fix their application and resubmit.
--
-- The column guard (0005 → 0015 → 0025 → 0028 → 0032 → 0033) only permitted the
-- owner transitions
--   draft | needs_more_info  ->  pending_review
-- so a rejected applicant was a dead end: the product promises "you can update
-- and resubmit", but the trigger raised on rejected -> pending_review. This
-- extends the legitimate self-service set to
--   draft | needs_more_info | rejected  ->  pending_review
-- and additionally requires the account NOT be banned for ANY self-service
-- transition (defence in depth — the app layer already refuses banned submits,
-- but a banned owner PATCHing PostgREST directly must also be stopped here).
--
-- BASELINE: this is the FULL function body from 0033 (the latest prior
-- definition, which includes the 0028 recommended-placement guards, the 0032
-- needs_location_review guard, and the 0033 labeled-badge guards) with ONLY the
-- review_status branch changed. `create or replace` swaps the whole body, so
-- copying an older baseline would silently drop those later guards — do not
-- rebuild this from 0025.
--
-- Everything else stays admin-only: approved / under_review states cannot be
-- entered or left by the owner.
--
-- ADDITIVE + IDEMPOTENT (create or replace + re-assert trigger). Privileged
-- writes (service_role / admins) bypass via public.is_privileged_writer().
-- Depends on 0033; must run after it.
-- ============================================================================

create or replace function public.guard_professional_profile_columns() returns trigger as $$
declare
  -- True when THIS update is the one legitimate self-service submit transition.
  -- Review-metadata columns may only move together with it (see below).
  is_submit boolean;
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  is_submit := new.review_status is distinct from old.review_status
    and old.review_status in ('draft', 'needs_more_info', 'rejected')
    and new.review_status = 'pending_review'
    and coalesce(old.account_status::text, 'active') = 'active';

  -- Approval / trust / revenue columns (0005).
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

  -- 0028: paid Recommended placement is platform-controlled.
  if new.is_recommended    is distinct from old.is_recommended
  or new.recommended_at    is distinct from old.recommended_at
  or new.recommended_until is distinct from old.recommended_until then
    raise exception 'recommended placement is set by the platform only';
  end if;

  -- 0032: location review flag is platform-controlled.
  if new.needs_location_review is distinct from old.needs_location_review then
    raise exception 'location review status is set by the platform only';
  end if;

  -- 0024/0025: account moderation lever. An owner must never move themselves out
  -- of a 'suspended'/'banned' state, nor forge the ban/suspend audit columns.
  if new.account_status is distinct from old.account_status
  or new.banned_at      is distinct from old.banned_at
  or new.banned_by      is distinct from old.banned_by
  or new.ban_reason     is distinct from old.ban_reason
  or new.suspended_at   is distinct from old.suspended_at then
    raise exception 'account moderation state is set by admins only';
  end if;

  -- Application review lifecycle (0023/0037). Owners may only submit or resubmit
  -- for review — from draft, needs_more_info, or rejected — and never while
  -- banned. Every other review_status transition (approved, under_review, …) is
  -- admin-only, keeping /admin approval authoritative, not advisory.
  if new.review_status is distinct from old.review_status and not is_submit then
    raise exception 'review status transition % -> % is not permitted', old.review_status, new.review_status;
  end if;

  -- 0037: admin review verdict metadata is NEVER owner-writable — the submit
  -- function doesn't touch it either. Nulling reviewed_at would defeat the
  -- fresh-ID recency check for rejected resubmissions.
  if new.reviewed_at is distinct from old.reviewed_at
  or new.reviewed_by is distinct from old.reviewed_by then
    raise exception 'review verdict metadata is set by admins only';
  end if;

  -- 0037: submission metadata moves ONLY together with the whitelisted submit
  -- transition, and only to canonical values. Outside it, a direct PostgREST
  -- PATCH could backdate submitted_at to jump the FIFO review queue, zero the
  -- resubmission counter, or set needs_info_sections to unlock full editing
  -- while under needs_more_info. submit_professional_application runs SECURITY
  -- DEFINER but is NOT a privileged writer, so these rules are written to admit
  -- exactly the values it sets: submitted_at = now(), counter +0/+1, notes
  -- cleared.
  if not is_submit then
    if new.submitted_at        is distinct from old.submitted_at
    or new.resubmission_count  is distinct from old.resubmission_count
    or new.needs_info_note     is distinct from old.needs_info_note
    or new.needs_info_sections is distinct from old.needs_info_sections
    or new.rejection_reason    is distinct from old.rejection_reason then
      raise exception 'application review metadata is set by the platform only';
    end if;
  else
    if new.submitted_at is null
       or new.submitted_at < now() - interval '5 minutes'
       or new.submitted_at > now() + interval '5 minutes' then
      raise exception 'submitted_at must be the actual submission time';
    end if;
    if new.resubmission_count is distinct from old.resubmission_count
       and new.resubmission_count is distinct from old.resubmission_count + 1 then
      raise exception 'resubmission_count may only increment by one on submit';
    end if;
    if new.needs_info_note is not null
       or coalesce(array_length(new.needs_info_sections, 1), 0) <> 0
       or new.rejection_reason is not null then
      raise exception 'review notes are cleared on submit, never set';
    end if;
  end if;

  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_pro_profile_column_guard on public.professional_profiles;
create trigger trg_pro_profile_column_guard
  before update on public.professional_profiles
  for each row execute function public.guard_professional_profile_columns();

-- Moderation is enforced at the database boundary, not only in server actions.
-- Suspended/banned owners retain read access to their own record, but cannot
-- mutate application/profile data, document rows, or files.
drop policy if exists "pro self update" on public.professional_profiles;
create policy "pro self update" on public.professional_profiles for update
  using (
    auth.uid() = user_id
    and coalesce(account_status::text, 'active') = 'active'
  )
  with check (
    auth.uid() = user_id
    and coalesce(account_status::text, 'active') = 'active'
  );

drop policy if exists "docs owner insert" on public.professional_documents;
create policy "docs owner insert" on public.professional_documents for insert
  with check (
    auth.uid() = professional_id
    and exists (
      select 1 from public.professional_profiles p
      where p.user_id = professional_id
        and coalesce(p.account_status::text, 'active') = 'active'
    )
  );

drop policy if exists "docs owner delete" on public.professional_documents;
create policy "docs owner delete" on public.professional_documents for delete
  using (
    auth.uid() = professional_id
    and exists (
      select 1 from public.professional_profiles p
      where p.user_id = professional_id
        and coalesce(p.account_status::text, 'active') = 'active'
    )
  );

-- Owner-inserted document rows always start in a pristine review state. Without
-- this, a pro could POST a professional_documents row with review_status =
-- 'verified' (or a forged reviewed_by/created_at) straight through PostgREST:
-- that forged row satisfies the admin approval gate (unmetApprovalRequirements),
-- gets laundered into the public identity/license/insurance badges by
-- syncVerificationBadges on approval, and defeats the fresh-ID recency check in
-- submit_professional_application. Privileged writers (admins / service role)
-- are untouched. Forcing values (instead of raising) keeps every legitimate
-- client insert working unchanged.
create or replace function public.guard_professional_document_insert() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;
  new.review_status := 'pending';
  new.flag_reason   := null;
  new.reviewed_by   := null;
  new.reviewed_at   := null;
  new.created_at    := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_pro_document_insert_guard on public.professional_documents;
create trigger trg_pro_document_insert_guard
  before insert on public.professional_documents
  for each row execute function public.guard_professional_document_insert();

-- storage.objects is owned by the storage extension role on hosted Supabase —
-- the SQL-editor session is sometimes not its owner and policy DDL then fails.
-- Wrapped so THAT failure aborts nothing else: the notice tells the operator to
-- apply this one policy via Dashboard → Storage → Policies instead.
do $$
begin
  begin
    drop policy if exists "verif docs owner rw" on storage.objects;
    create policy "verif docs owner rw" on storage.objects for all
      using (
        bucket_id = 'verification-docs'
        and (
          public.is_admin(auth.uid())
          or (
            auth.uid()::text = (storage.foldername(name))[1]
            and exists (
              select 1 from public.professional_profiles p
              where p.user_id = auth.uid()
                and coalesce(p.account_status::text, 'active') = 'active'
            )
          )
        )
      )
      with check (
        bucket_id = 'verification-docs'
        and auth.uid()::text = (storage.foldername(name))[1]
        and exists (
          select 1 from public.professional_profiles p
          where p.user_id = auth.uid()
            and coalesce(p.account_status::text, 'active') = 'active'
        )
      );
  exception when insufficient_privilege then
    raise notice 'NOT APPLIED: storage.objects policy "verif docs owner rw" — this role does not own storage.objects. Recreate the policy with the active-account condition via Dashboard -> Storage -> Policies.';
  end;
end $$;

-- Atomic submit/resubmit. Expected-state matching makes repeat taps idempotent:
-- only the first call can transition the row. Rejected applications require a
-- fresh, pending ID uploaded after the rejection decision.
create or replace function public.submit_professional_application(
  p_expected_status public.professional_review_status
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_uid uuid := auth.uid();
  v_profile public.professional_profiles%rowtype;
  v_resubmit boolean;
begin
  if v_uid is null then
    raise exception 'Sign in required';
  end if;

  select * into v_profile
  from public.professional_profiles
  where user_id = v_uid
  for update;

  if not found then raise exception 'Application not found'; end if;
  if coalesce(v_profile.account_status::text, 'active') <> 'active' then
    raise exception 'This account cannot submit an application right now';
  end if;
  if v_profile.review_status <> p_expected_status
     or p_expected_status::text not in ('draft','needs_more_info','rejected') then
    raise exception 'Application state changed; refresh and try again';
  end if;

  if p_expected_status::text = 'rejected' and not exists (
    select 1 from public.professional_documents d
    where d.professional_id = v_uid
      and d.kind = 'id_document'
      and d.review_status = 'pending'
      and d.created_at > coalesce(v_profile.reviewed_at, '-infinity'::timestamptz)
  ) then
    raise exception 'Upload a fresh government ID before resubmitting';
  end if;

  v_resubmit := p_expected_status::text in ('needs_more_info','rejected');

  update public.professional_profiles
  set review_status = 'pending_review',
      submitted_at = now(),
      needs_info_note = null,
      needs_info_sections = '{}',
      rejection_reason = null,
      resubmission_count = resubmission_count + case when v_resubmit then 1 else 0 end
  where user_id = v_uid
    and review_status = p_expected_status;

  if not found then
    raise exception 'Application state changed; refresh and try again';
  end if;

  if v_resubmit then
    update public.professional_documents
    set review_status = 'pending', flag_reason = null
    where professional_id = v_uid
      and review_status = 'flagged';
  end if;

  insert into public.verification_events(
    professional_id, actor_id, action, visible_to_applicant
  ) values (
    v_uid, v_uid, case when v_resubmit then 'resubmitted' else 'submitted' end, false
  );
end;
$$;

revoke all on function public.submit_professional_application(public.professional_review_status) from public;
grant execute on function public.submit_professional_application(public.professional_review_status) to authenticated;

-- Verify:
-- select prosrc from pg_proc where proname = 'guard_professional_profile_columns';
-- (must contain: 'rejected' in the transition whitelist AND the 0028/0032/0033
--  guard clauses — identity_verified, is_recommended, needs_location_review)
