-- ============================================================================
-- 0031_admin_gate.sql — admin passcode gate
--
-- A second factor on top of the account role=admin check: a passcode the admin
-- sets and can change anytime from Settings. Stored as a scrypt hash in a
-- table that is SERVICE-ROLE ONLY (RLS enabled, no policies) — unlike
-- platform_settings, which is publicly readable, so the hash could never live
-- there. Only the server (service-role client) reads/writes this row.
--
-- Additive & idempotent.
-- ============================================================================

create table if not exists public.admin_gate (
  id            boolean primary key default true check (id),   -- singleton row
  passcode_hash text not null,
  updated_by    uuid references public.profiles(id),
  updated_at    timestamptz not null default now()
);

-- RLS on, NO policies → no anon/auth client can read or write. The service-role
-- client (server actions / gate checks) bypasses RLS and is the only accessor.
alter table public.admin_gate enable row level security;
