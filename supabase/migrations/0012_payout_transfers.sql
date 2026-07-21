-- Phase 11 — Stripe Connect payout transfers.
-- Tracks each transfer of a professional's net earning to their connected account
-- (separate charges + transfers model). One row per booking (idempotent), with
-- status/failure tracking for reconciliation and failed-payout recovery.

create table if not exists public.payout_transfers (
  id                 uuid primary key default gen_random_uuid(),
  booking_id         uuid not null references public.bookings(id) on delete cascade,
  professional_id    uuid not null references public.professional_profiles(user_id) on delete cascade,
  stripe_transfer_id text unique,
  amount_cents       integer not null check (amount_cents >= 0),
  status             text not null default 'pending',   -- pending | paid | failed | reversed
  failure_reason     text,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  unique (booking_id)                                    -- exactly one payout per booking
);
create index if not exists payout_transfers_pro_idx on public.payout_transfers (professional_id, created_at desc);
create index if not exists payout_transfers_status_idx on public.payout_transfers (status, created_at desc);

alter table public.payout_transfers enable row level security;
do $$ begin
  create policy "payout_transfers own read" on public.payout_transfers
    for select using (auth.uid() = professional_id or public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
-- All writes happen via the service-role (server) only — webhook + retry action.
