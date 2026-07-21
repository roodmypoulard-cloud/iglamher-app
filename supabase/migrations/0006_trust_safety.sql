-- ============================================================
-- iGlamHer — 0006 Trust, Safety & Operations
-- Verification, multi-dimension reviews, reports/moderation, blocks,
-- privacy, fraud flags, dispute evidence/timeline, reliability metrics.
-- Append-only: assumes 0001–0005 applied.
-- ============================================================

-- ---------- enum extensions ----------
alter type public.verification_status add value if not exists 'more_info_requested';
alter type public.verification_status add value if not exists 'suspended';
alter type public.verification_status add value if not exists 'revoked';

alter type public.dispute_status add value if not exists 'awaiting_response';
alter type public.dispute_status add value if not exists 'under_investigation';
alter type public.dispute_status add value if not exists 'closed';

-- ---------- new enums ----------
do $$ begin
  create type public.report_reason as enum
    ('harassment','fraud','spam','inappropriate','fake_profile','safety','copyright','other');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.report_status as enum ('open','reviewing','actioned','dismissed');
exception when duplicate_object then null; end $$;
do $$ begin
  create type public.fraud_status as enum ('flagged','reviewing','cleared','actioned');
exception when duplicate_object then null; end $$;

-- ---------- provider verification (documents + trust flags) ----------
alter table public.professional_verifications
  add column if not exists selfie_url           text,
  add column if not exists business_license_url text,
  add column if not exists insurance_url        text,
  add column if not exists license_verified     boolean not null default false,
  add column if not exists insured              boolean not null default false,
  add column if not exists background_checked   boolean not null default false,
  add column if not exists requested_info       text,
  add column if not exists expires_at           timestamptz;

-- ---------- reliability + safety flags on profiles ----------
alter table public.professional_profiles
  add column if not exists reliability_score        integer not null default 80,
  add column if not exists acceptance_rate          numeric(5,2),
  add column if not exists completion_rate          numeric(5,2),
  add column if not exists cancellation_rate        numeric(5,2),
  add column if not exists require_verified_customers boolean not null default false,
  add column if not exists is_frozen                boolean not null default false,
  add column if not exists payouts_frozen           boolean not null default false;

alter table public.customer_profiles
  add column if not exists is_id_verified     boolean not null default false,
  add column if not exists verification_status public.verification_status not null default 'unsubmitted',
  add column if not exists id_document_url    text,
  add column if not exists selfie_url         text,
  add column if not exists reliability_score  integer not null default 80,
  add column if not exists cancellation_rate  numeric(5,2),
  add column if not exists is_frozen          boolean not null default false;

-- ---------- multi-dimension reviews ----------
alter table public.reviews
  add column if not exists professionalism smallint check (professionalism between 1 and 5),
  add column if not exists communication   smallint check (communication between 1 and 5),
  add column if not exists punctuality     smallint check (punctuality between 1 and 5),
  add column if not exists cleanliness     smallint check (cleanliness between 1 and 5),
  add column if not exists accuracy        smallint check (accuracy between 1 and 5),
  add column if not exists photo_urls      text[] not null default '{}',
  add column if not exists helpful_count   integer not null default 0,
  add column if not exists is_reported     boolean not null default false;

create table if not exists public.review_helpful_votes (
  review_id uuid not null references public.reviews(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (review_id, user_id)
);
alter table public.review_helpful_votes enable row level security;
do $$ begin
  create policy "helpful own" on public.review_helpful_votes for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- content reports / moderation queue ----------
create table if not exists public.content_reports (
  id          uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.profiles(id) on delete cascade,
  target_type text not null,      -- user | professional | message | review | portfolio
  target_id   uuid not null,
  reason      public.report_reason not null,
  detail      text,
  status      public.report_status not null default 'open',
  resolved_by uuid references public.profiles(id),
  resolution  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
alter table public.content_reports enable row level security;
do $$ begin
  create policy "reports insert own" on public.content_reports for insert with check (auth.uid() = reporter_id);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "reports read own or admin" on public.content_reports for select
    using (auth.uid() = reporter_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;

-- ---------- blocks ----------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  check (blocker_id <> blocked_id)
);
alter table public.blocks enable row level security;
do $$ begin
  create policy "blocks by blocker" on public.blocks for all
    using (auth.uid() = blocker_id) with check (auth.uid() = blocker_id);
exception when duplicate_object then null; end $$;
-- A user may also read blocks where they are the blocked party (to enforce).
do $$ begin
  create policy "blocks read as blocked" on public.blocks for select using (auth.uid() = blocked_id);
exception when duplicate_object then null; end $$;

-- ---------- privacy settings ----------
create table if not exists public.privacy_settings (
  user_id            uuid primary key references public.profiles(id) on delete cascade,
  profile_visibility text not null default 'public',   -- public | verified_only | private
  allow_messages     boolean not null default true,
  allow_calls        boolean not null default true,
  mute_notifications boolean not null default false,
  updated_at         timestamptz not null default now()
);
alter table public.privacy_settings enable row level security;
do $$ begin
  create policy "privacy own" on public.privacy_settings for all
    using (auth.uid() = user_id) with check (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ---------- fraud flags (admin/service-role only; RLS on, no client policy = deny) ----------
create table if not exists public.fraud_flags (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  kind       text not null,
  score      integer not null default 0,
  severity   text not null default 'low',
  detail     jsonb not null default '{}'::jsonb,
  status     public.fraud_status not null default 'flagged',
  created_at timestamptz not null default now()
);
alter table public.fraud_flags enable row level security;

-- ---------- dispute evidence + timeline ----------
create table if not exists public.dispute_evidence (
  id          uuid primary key default gen_random_uuid(),
  dispute_id  uuid not null references public.disputes(id) on delete cascade,
  uploaded_by uuid not null references public.profiles(id),
  url         text not null,
  kind        text not null default 'photo',   -- photo | screenshot | document
  created_at  timestamptz not null default now()
);
create table if not exists public.dispute_events (
  id         uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.disputes(id) on delete cascade,
  actor_id   uuid references public.profiles(id),
  action     text not null,
  note       text,
  created_at timestamptz not null default now()
);
alter table public.dispute_evidence enable row level security;
alter table public.dispute_events enable row level security;
do $$ begin
  create policy "dispute evidence parties" on public.dispute_evidence for select using (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.disputes d join public.bookings b on b.id = d.booking_id
      where d.id = dispute_id and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
    )
  );
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "dispute evidence upload" on public.dispute_evidence for insert with check (auth.uid() = uploaded_by);
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "dispute events parties" on public.dispute_events for select using (
    public.is_admin(auth.uid()) or exists (
      select 1 from public.disputes d join public.bookings b on b.id = d.booking_id
      where d.id = dispute_id and (b.customer_id = auth.uid() or b.professional_id = auth.uid())
    )
  );
exception when duplicate_object then null; end $$;

-- ---------- indexes ----------
create index if not exists audit_entity_idx        on public.audit_logs (entity, entity_id);
create index if not exists audit_actor_idx         on public.audit_logs (actor_id, created_at desc);
create index if not exists reports_status_idx      on public.content_reports (status, created_at desc);
create index if not exists reports_target_idx      on public.content_reports (target_type, target_id);
create index if not exists fraud_status_idx        on public.fraud_flags (status, score desc);
create index if not exists verifications_status_idx on public.professional_verifications (status);
create index if not exists blocks_blocked_idx      on public.blocks (blocked_id);
create index if not exists pro_reliability_idx     on public.professional_profiles (reliability_score desc);
