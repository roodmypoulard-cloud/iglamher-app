-- poulard-intake lives as an isolated tenant inside the iglamher-prod Supabase
-- project (free plan allows only 2 active projects). Everything is in its own
-- schema; only the server-side service_role key can touch it.
create schema if not exists intake;
revoke all on schema intake from public, anon, authenticated;
grant usage on schema intake to service_role;

create table if not exists intake.contractors (
  id uuid primary key default gen_random_uuid(),
  email text unique not null,
  password_hash text not null,
  full_name text not null,
  phone text, job_title text,
  pay_method text,
  pay_details jsonb default '{}'::jsonb,
  created_at timestamptz default now()
);

create table if not exists intake.submissions (
  id uuid primary key default gen_random_uuid(),
  contractor_id uuid references intake.contractors(id) on delete cascade,
  gig text, amount text, note text,
  invoice_path text, invoice_name text,
  w9_path text, w9_name text,
  status text default 'pending',
  paid_at timestamptz,
  created_at timestamptz default now()
);
create index if not exists submissions_contractor_id_idx on intake.submissions(contractor_id);

alter table intake.contractors enable row level security;
alter table intake.submissions enable row level security;
revoke all on all tables in schema intake from public, anon, authenticated;
grant all on all tables in schema intake to service_role;
alter default privileges in schema intake revoke all on tables from public, anon, authenticated;
alter default privileges in schema intake grant all on tables to service_role;
