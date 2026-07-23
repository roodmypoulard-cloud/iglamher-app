-- ============================================================================
-- 0027_job_requests.sql — Customer Job Marketplace (customer-posted requests)
--
-- Customers post beauty job requests (makeup, hair, nails, lashes, bridal,
-- events, house calls, custom). Requests are visible to other signed-in users
-- (the customer feed) and to active professionals (who will consume them in a
-- later Professional Mode task — the read policy already allows it).
--
-- Additive & idempotent. No data dropped.
-- ============================================================================

create table if not exists public.job_requests (
  id              uuid primary key default gen_random_uuid(),
  customer_id     uuid not null references public.profiles(id) on delete cascade,
  category        text not null check (category in
                    ('makeup','hair','nails','lashes','bridal','event','house_call','custom')),
  title           text not null check (char_length(title) between 3 and 80),
  description     text not null check (char_length(description) between 10 and 2000),
  photos          jsonb not null default '[]'::jsonb,          -- [{path, url}] inspiration photos
  preferred_date  date,
  time_window     text check (time_window in ('morning','afternoon','evening','flexible')),
  location_text   text not null check (char_length(location_text) between 2 and 120),
  is_house_call   boolean not null default false,
  budget_cents    integer check (budget_cents is null or budget_cents between 100 and 1000000),
  currency        char(3) not null default 'USD',
  status          text not null default 'open' check (status in
                    ('open','matched','closed','cancelled','expired')),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists job_requests_feed_idx
  on public.job_requests (status, created_at desc);
create index if not exists job_requests_customer_idx
  on public.job_requests (customer_id, created_at desc);
create index if not exists job_requests_category_idx
  on public.job_requests (category, status, created_at desc);

alter table public.job_requests enable row level security;

-- Owner reads their own requests in any status.
do $$ begin
  create policy "job req owner read" on public.job_requests for select
    using (auth.uid() = customer_id);
exception when duplicate_object then null; end $$;

-- Any signed-in user reads OPEN requests (customer browse feed now; active
-- professionals will consume the same policy later — no schema change needed).
do $$ begin
  create policy "job req open read" on public.job_requests for select
    using (auth.uid() is not null and status = 'open');
exception when duplicate_object then null; end $$;

-- Owner creates their own requests.
do $$ begin
  create policy "job req owner insert" on public.job_requests for insert
    with check (auth.uid() = customer_id);
exception when duplicate_object then null; end $$;

-- Owner updates their own requests (columns constrained by the guard below).
do $$ begin
  create policy "job req owner update" on public.job_requests for update
    using (auth.uid() = customer_id) with check (auth.uid() = customer_id);
exception when duplicate_object then null; end $$;

-- Column guard (same idiom as 0005/0025/0026): owners may edit content fields
-- while the request is open, and the only self-service status transition is
-- open -> cancelled. matched/closed/expired are set by the platform.
create or replace function public.guard_job_request_columns() returns trigger as $$
begin
  if public.is_privileged_writer() then
    return new;
  end if;

  if new.customer_id is distinct from old.customer_id
  or new.created_at  is distinct from old.created_at
  or new.currency    is distinct from old.currency then
    raise exception 'job request identity fields are immutable';
  end if;

  if new.status is distinct from old.status then
    if not (old.status = 'open' and new.status = 'cancelled') then
      raise exception 'job request status transition % -> % is not permitted', old.status, new.status;
    end if;
  elsif old.status <> 'open' then
    raise exception 'only open job requests can be edited';
  end if;

  new.updated_at := now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_job_request_column_guard on public.job_requests;
create trigger trg_job_request_column_guard
  before update on public.job_requests
  for each row execute function public.guard_job_request_columns();
