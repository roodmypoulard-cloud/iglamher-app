-- Phase — deposit + saved card + day-of balance hold + capture at completion.
-- Adds the payment references needed to: save the customer's card at deposit,
-- authorize (hold) the remaining balance when the pro starts the job, and capture
-- it at completion. Additive & idempotent. No data dropped.

alter table public.bookings
  add column if not exists stripe_customer_id       text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists balance_hold_pi_id       text,   -- authorization PaymentIntent for the balance
  add column if not exists balance_cents            integer not null default 0,
  add column if not exists balance_status           text not null default 'none';
  -- balance_status: none | held | captured | released | failed

create index if not exists bookings_balance_status_idx
  on public.bookings (balance_status) where balance_status in ('held', 'failed');
