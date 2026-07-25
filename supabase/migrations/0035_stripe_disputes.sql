-- 0035: Stripe card disputes (chargebacks) recorded from charge.dispute.* webhooks.
-- Append-only + idempotent, safe on fresh/staging/prod.

-- Payments can now read as disputed while a chargeback is open.
alter type public.payment_status add value if not exists 'disputed';

create table if not exists public.stripe_disputes (
  id                        text primary key,             -- Stripe dispute id (dp_...)
  stripe_charge_id          text,
  stripe_payment_intent_id  text,
  booking_id                uuid references public.bookings(id) on delete set null,
  amount_cents              integer not null default 0,
  currency                  text not null default 'usd',
  reason                    text,
  status                    text not null default 'needs_response', -- needs_response | under_review | won | lost | warning_*
  evidence_due_by           timestamptz,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now()
);

create index if not exists stripe_disputes_status_idx on public.stripe_disputes (status, created_at desc);
create index if not exists stripe_disputes_booking_idx on public.stripe_disputes (booking_id);

alter table public.stripe_disputes enable row level security;

-- Admin-only reads; writes come from the webhook via the service role (bypasses RLS).
do $$ begin
  create policy "stripe disputes admin read" on public.stripe_disputes for select
    using (public.is_admin(auth.uid()));
exception when duplicate_object then null; end $$;
