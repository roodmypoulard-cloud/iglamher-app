-- 0023 — Pro verification review system.
-- ADDITIVE + IDEMPOTENT + production-safe: no existing column/enum/policy/data is
-- dropped, renamed, or overwritten. Safe to re-run.

-- 1) New profile columns (all nullable or defaulted). reviewed_by is a nullable FK
--    with ON DELETE SET NULL so removing an admin never breaks an application row.
alter table public.professional_profiles
  add column if not exists tiktok_handle              text,
  add column if not exists website_url                text,
  add column if not exists portfolio_url              text,
  add column if not exists submitted_at               timestamptz,
  add column if not exists reviewed_at                timestamptz,
  add column if not exists reviewed_by                uuid references public.profiles(id) on delete set null,
  add column if not exists rejection_reason           text,
  add column if not exists needs_info_note            text,
  add column if not exists needs_info_sections        text[] not null default '{}',
  add column if not exists stripe_identity_session_id text;  -- nullable; Stripe Identity added later

-- 2) Extend the review-status enum (idempotent; existing values untouched)
alter type public.professional_review_status add value if not exists 'under_review';
alter type public.professional_review_status add value if not exists 'needs_more_info';

-- 3) Documents (certifications, licenses, ID). Only paths are stored here; the files
--    live in the PRIVATE 'verification-docs' bucket.
create table if not exists public.professional_documents (
  id              uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(user_id) on delete cascade,
  kind            text not null check (kind in ('certification','license','id_document')),
  file_path       text not null,
  file_name       text,
  mime_type       text,
  size_bytes      integer,
  created_at      timestamptz not null default now()
);
create index if not exists prof_docs_pro_idx on public.professional_documents(professional_id);
alter table public.professional_documents enable row level security;

-- 4) Verification events: immutable audit log AND internal admin notes.
create table if not exists public.verification_events (
  id                   uuid primary key default gen_random_uuid(),
  professional_id      uuid not null references public.professional_profiles(user_id) on delete cascade,
  actor_id             uuid references public.profiles(id) on delete set null,  -- null = applicant/system
  action               text not null check (action in
                         ('submitted','resubmitted','opened','approved','rejected','needs_more_info','note')),
  body                 text,
  visible_to_applicant boolean not null default false,
  created_at           timestamptz not null default now()
);
create index if not exists verif_events_pro_idx on public.verification_events(professional_id, created_at desc);
alter table public.verification_events enable row level security;

-- 5) RLS policies (guarded so re-runs never error; is_admin() already exists from 0002)
do $$
begin
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_documents' and policyname='docs owner select') then
    create policy "docs owner select" on public.professional_documents for select
      using (auth.uid() = professional_id or public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_documents' and policyname='docs owner insert') then
    create policy "docs owner insert" on public.professional_documents for insert
      with check (auth.uid() = professional_id);
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='professional_documents' and policyname='docs owner delete') then
    create policy "docs owner delete" on public.professional_documents for delete
      using (auth.uid() = professional_id);
  end if;

  if not exists (select 1 from pg_policies where schemaname='public' and tablename='verification_events' and policyname='events admin all') then
    create policy "events admin all" on public.verification_events for all
      using (public.is_admin(auth.uid())) with check (public.is_admin(auth.uid()));
  end if;
  if not exists (select 1 from pg_policies where schemaname='public' and tablename='verification_events' and policyname='events applicant read') then
    create policy "events applicant read" on public.verification_events for select
      using (auth.uid() = professional_id and visible_to_applicant);
  end if;
end $$;

-- 6) PRIVATE storage bucket for certifications + ID docs. Never public URLs.
insert into storage.buckets (id, name, public)
  values ('verification-docs', 'verification-docs', false)
  on conflict (id) do nothing;

do $$
begin
  -- Owner may read/write/delete only files under their own {userId}/... folder.
  -- Admins may read every file (used to mint short-expiry signed URLs server-side).
  if not exists (select 1 from pg_policies where schemaname='storage' and tablename='objects' and policyname='verif docs owner rw') then
    create policy "verif docs owner rw" on storage.objects for all
      using (
        bucket_id = 'verification-docs'
        and (auth.uid()::text = (storage.foldername(name))[1] or public.is_admin(auth.uid()))
      )
      with check (
        bucket_id = 'verification-docs'
        and auth.uid()::text = (storage.foldername(name))[1]
      );
  end if;
end $$;

-- Verify:
-- select column_name from information_schema.columns where table_name='professional_profiles' and column_name in ('tiktok_handle','submitted_at','reviewed_by');
-- select unnest(enum_range(null::public.professional_review_status));
