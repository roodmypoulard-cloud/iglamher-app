-- Verification fixtures. Runs as superuser (bypasses RLS) to establish state.
-- Fixed UUIDs so the RLS tests can reference them.

insert into auth.users (id, email) values
  ('11111111-1111-1111-1111-111111111111', 'customer.a@test.local'),
  ('22222222-2222-2222-2222-222222222222', 'customer.b@test.local'),
  ('33333333-3333-3333-3333-333333333333', 'pro.a@test.local'),
  ('44444444-4444-4444-4444-444444444444', 'pro.b@test.local'),
  ('55555555-5555-5555-5555-555555555555', 'admin@test.local'),
  ('66666666-6666-6666-6666-666666666666', 'pro.c@test.local')
on conflict (id) do nothing;

-- handle_new_user() already created these rows with role='customer'. Promoting
-- to professional/admin is a privileged write, and prevent_role_escalation()
-- correctly refuses it unless auth.role() = 'service_role' -- which is exactly
-- what the app's admin path uses. Impersonate that role rather than weakening
-- the guard.
set role service_role;

insert into public.profiles (id, role, full_name) values
  ('11111111-1111-1111-1111-111111111111', 'customer',     'Customer A'),
  ('22222222-2222-2222-2222-222222222222', 'customer',     'Customer B'),
  ('33333333-3333-3333-3333-333333333333', 'professional', 'Pro A'),
  ('44444444-4444-4444-4444-444444444444', 'professional', 'Pro B'),
  ('55555555-5555-5555-5555-555555555555', 'admin',        'Admin'),
  ('66666666-6666-6666-6666-666666666666', 'professional', 'Pro C')
on conflict (id) do update set role = excluded.role, full_name = excluded.full_name;

insert into public.admin_roles (user_id, kind)
values ('55555555-5555-5555-5555-555555555555', 'admin')
on conflict do nothing;

-- Two approved professionals.
insert into public.professional_profiles
  (user_id, slug, business_name, is_active, is_verified, take_rate_bps)
values
  ('33333333-3333-3333-3333-333333333333', 'pro-a', 'Pro A Studio', true, true, 1500),
  ('44444444-4444-4444-4444-444444444444', 'pro-b', 'Pro B Studio', true, true, 1500),
  -- Pending pro: NOT approved, NOT verified. This is the realistic subject of
  -- the self-approval attack -- testing it against an already-approved pro is a
  -- no-op update that never trips the guard.
  ('66666666-6666-6666-6666-666666666666', 'pro-c', 'Pro C Studio', false, false, 1500)
on conflict (user_id) do nothing;

-- A service owned by Pro A.
insert into public.services (id, professional_id, name, duration_minutes, price_cents)
values ('aaaaaaaa-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333', 'Silk Press', 90, 12000)
on conflict (id) do nothing;

-- Availability owned by Pro A.
insert into public.availability_rules (id, professional_id, weekday, start_minute, end_minute)
values ('bbbbbbbb-0000-0000-0000-000000000001',
        '33333333-3333-3333-3333-333333333333', 1, 540, 1020)
on conflict (id) do nothing;

-- A booking: Customer A with Pro A.
insert into public.bookings (
  id, customer_id, professional_id, service_id, status,
  starts_at, ends_at, timezone, location_type,
  service_name_snapshot, subtotal_cents, total_cents,
  amount_due_now_cents, platform_fee_cents
) values (
  'cccccccc-0000-0000-0000-000000000001',
  '11111111-1111-1111-1111-111111111111',
  '33333333-3333-3333-3333-333333333333',
  'aaaaaaaa-0000-0000-0000-000000000001',
  -- Must be completed: enforce_review_eligibility() only allows a review on a
  -- completed booking belonging to the reviewer.
  'completed',
  now() - interval '3 days', now() - interval '3 days' + interval '90 minutes',
  'America/Los_Angeles', 'studio',
  'Silk Press', 12000, 12000, 12000, 1800
) on conflict (id) do nothing;

-- A published review of Pro A by Customer A.
insert into public.reviews (id, booking_id, customer_id, professional_id, rating, body)
values ('dddddddd-0000-0000-0000-000000000001',
        'cccccccc-0000-0000-0000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        '33333333-3333-3333-3333-333333333333',
        2, 'Ran late and rushed the finish.')
on conflict (id) do nothing;

-- Customer A favourites Pro B.
insert into public.favorites (customer_id, professional_id)
values ('11111111-1111-1111-1111-111111111111',
        '44444444-4444-4444-4444-444444444444')
on conflict do nothing;

reset role;
