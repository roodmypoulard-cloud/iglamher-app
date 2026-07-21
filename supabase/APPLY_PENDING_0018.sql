-- iGlamHer — Migration 0018: deposit + saved card + day-of balance hold.
-- Run ONCE in the Supabase SQL Editor, AFTER 0017. Additive & idempotent.
begin;
alter table public.bookings
  add column if not exists stripe_customer_id       text,
  add column if not exists stripe_payment_method_id text,
  add column if not exists balance_hold_pi_id       text,
  add column if not exists balance_cents            integer not null default 0,
  add column if not exists balance_status           text not null default 'none';
create index if not exists bookings_balance_status_idx
  on public.bookings (balance_status) where balance_status in ('held','failed');
commit;
-- Verify (expect 5 rows)
select column_name from information_schema.columns where table_schema='public' and table_name='bookings'
  and column_name in ('stripe_customer_id','stripe_payment_method_id','balance_hold_pi_id','balance_cents','balance_status')
  order by column_name;
