-- Paste this into the Supabase SQL editor and run it.
-- Adds Stripe customer columns to profiles for account-level saved cards.
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_default_payment_method_id text;

-- Verify:
select column_name from information_schema.columns
where table_schema = 'public' and table_name = 'profiles'
  and column_name in ('stripe_customer_id','stripe_default_payment_method_id');
