-- 0024 — Admin application review + moderation: extend existing tables (no duplicates).
-- ADDITIVE + IDEMPOTENT + production-safe. Extends professional_profiles (application +
-- account state), professional_documents (per-doc review), and verification_events
-- (into a general admin audit log). Safe to re-run. Reuses tables from 0023 — nothing
-- is dropped, renamed, or overwritten except widening two CHECK constraints (superset).

-- 1) professional_profiles: school + account moderation state + resubmission counter.
--    account_status is the ACCOUNT lever (independent of the application review_status):
--    'active' can use pro features; 'suspended' is hidden + blocked temporarily;
--    'banned' is hidden everywhere and can never re-apply.
alter table public.professional_profiles
  add column if not exists school             text,
  add column if not exists account_status     text not null default 'active'
                                              check (account_status in ('active','suspended','banned')),
  add column if not exists banned_at          timestamptz,
  add column if not exists banned_by          uuid references public.profiles(id) on delete set null,
  add column if not exists ban_reason         text,
  add column if not exists suspended_at        timestamptz,
  add column if not exists resubmission_count integer not null default 0;

create index if not exists prof_account_status_idx on public.professional_profiles(account_status);

-- 2) professional_documents: per-document review state so admins can Verify / Flag each
--    file, plus a wider doc-type vocabulary. Widen the kind CHECK to a superset.
alter table public.professional_documents
  add column if not exists review_status text not null default 'pending'
                                        check (review_status in ('pending','verified','flagged')),
  add column if not exists flag_reason   text,
  add column if not exists reviewed_by   uuid references public.profiles(id) on delete set null,
  add column if not exists reviewed_at   timestamptz;

alter table public.professional_documents drop constraint if exists professional_documents_kind_check;
alter table public.professional_documents add constraint professional_documents_kind_check
  check (kind in ('certification','license','id_document',
                  'diploma','certificate','insurance','portfolio_photo','other'));

-- 3) verification_events -> admin audit log. Add target + metadata; widen the action
--    vocabulary to cover account moderation and per-document decisions.
alter table public.verification_events
  add column if not exists target_type text not null default 'application',
  add column if not exists target_id   uuid,
  add column if not exists metadata    jsonb not null default '{}'::jsonb;

alter table public.verification_events drop constraint if exists verification_events_action_check;
alter table public.verification_events add constraint verification_events_action_check
  check (action in (
    'submitted','resubmitted','opened','approved','rejected','needs_more_info','note',
    'changes_requested','doc_verified','doc_flagged',
    'suspended','unsuspended','banned','unbanned',
    'verified_on','verified_off','featured_on','featured_off'
  ));

create index if not exists verif_events_target_idx on public.verification_events(target_type, target_id);

-- Verify:
-- select column_name from information_schema.columns where table_name='professional_profiles' and column_name in ('school','account_status','resubmission_count');
-- select column_name from information_schema.columns where table_name='professional_documents' and column_name in ('review_status','flag_reason');
