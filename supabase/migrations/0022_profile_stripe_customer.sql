-- Account-level saved cards. Stores the user's Stripe customer id so saved
-- payment methods (added via SetupIntent) persist across bookings. The default
-- card lives in Stripe (customer.invoice_settings.default_payment_method); we
-- mirror it here for quick reads. Feature degrades gracefully if this is absent
-- (falls back to a Stripe customer search by metadata.userId).
alter table public.profiles
  add column if not exists stripe_customer_id text,
  add column if not exists stripe_default_payment_method_id text;
