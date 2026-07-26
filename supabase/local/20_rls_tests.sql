-- ============================================================================
-- RLS / policy verification suite.
--
-- Impersonates real users exactly as PostgREST does:
--   set role authenticated;
--   set request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
--
-- "Blocked" means either an exception (trigger guard) or zero rows
-- affected/visible (RLS policy). Both are legitimate denials, so the harness
-- treats either as blocked and reports which one occurred.
-- ============================================================================

\set QUIET on
\set ON_ERROR_STOP off

create schema if not exists tst;

create table if not exists tst.results (
  id serial primary key,
  area text,
  label text,
  expected text,
  actual text,
  detail text,
  pass boolean
);
truncate tst.results;

-- Runs `stmt` in a subtransaction and records whether it was denied.
create or replace function tst.check_write(
  p_area text, p_label text, p_stmt text, p_expect text  -- 'blocked' | 'allowed'
) returns void as $$
declare
  n bigint;
  act text;
  det text := '';
begin
  begin
    execute p_stmt;
    get diagnostics n = row_count;
    if n = 0 then
      act := 'blocked';
      det := 'rls: 0 rows affected';
    else
      act := 'allowed';
      det := n || ' row(s)';
    end if;
  exception when others then
    act := 'blocked';
    det := 'error: ' || left(sqlerrm, 70);
  end;

  insert into tst.results(area, label, expected, actual, detail, pass)
  values (p_area, p_label, p_expect, act, det, act = p_expect);
end;
$$ language plpgsql;

-- Records how many rows a query can see.
create or replace function tst.check_read(
  p_area text, p_label text, p_query text, p_expect text  -- 'empty' | 'nonempty'
) returns void as $$
declare
  n bigint;
  act text;
  det text := '';
begin
  begin
    execute 'select count(*) from (' || p_query || ') q' into n;
    act := case when n = 0 then 'empty' else 'nonempty' end;
    det := n || ' row(s) visible';
  exception when others then
    act := 'empty';
    det := 'error: ' || left(sqlerrm, 70);
  end;

  insert into tst.results(area, label, expected, actual, detail, pass)
  values (p_area, p_label, p_expect, act, det, act = p_expect);
end;
$$ language plpgsql;

grant usage on schema tst to authenticated, anon, service_role;
grant all on tst.results to authenticated, anon, service_role;
grant all on sequence tst.results_id_seq to authenticated, anon, service_role;
grant execute on function tst.check_write(text,text,text,text) to authenticated, anon, service_role;
grant execute on function tst.check_read(text,text,text,text) to authenticated, anon, service_role;

-- UUID shorthands
--   CustA 1111...  CustB 2222...  ProA 3333...  ProB 4444...  Admin 5555...

-- ============================================================
-- CUSTOMER B acting against CUSTOMER A
-- ============================================================
set role authenticated;
set request.jwt.claims = '{"sub":"22222222-2222-2222-2222-222222222222","role":"authenticated"}';

select tst.check_read('customer', 'cannot read another customer profile',
  $q$ select 1 from public.profiles where id='11111111-1111-1111-1111-111111111111' $q$, 'empty');

select tst.check_write('customer', 'cannot edit another customer profile',
  $s$ update public.profiles set full_name='HACKED' where id='11111111-1111-1111-1111-111111111111' $s$, 'blocked');

select tst.check_read('customer', 'cannot read another customer bookings',
  $q$ select 1 from public.bookings where customer_id='11111111-1111-1111-1111-111111111111' $q$, 'empty');

select tst.check_write('customer', 'cannot delete another customer favorite',
  $s$ delete from public.favorites where customer_id='11111111-1111-1111-1111-111111111111' $s$, 'blocked');

select tst.check_write('customer', 'cannot insert favorite as another customer',
  $s$ insert into public.favorites(customer_id, professional_id)
      values('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333') $s$, 'blocked');

select tst.check_read('customer', 'cannot read another customer private profile row',
  $q$ select 1 from public.customer_profiles where user_id='11111111-1111-1111-1111-111111111111' $q$, 'empty');

select tst.check_write('customer', 'cannot self-escalate role to admin',
  $s$ update public.profiles set role='admin' where id='22222222-2222-2222-2222-222222222222' $s$, 'blocked');

-- ============================================================
-- CUSTOMER A against their own booking (money immutability)
-- ============================================================
set request.jwt.claims = '{"sub":"11111111-1111-1111-1111-111111111111","role":"authenticated"}';

select tst.check_read('customer', 'can read own booking',
  $q$ select 1 from public.bookings where customer_id='11111111-1111-1111-1111-111111111111' $q$, 'nonempty');

select tst.check_write('booking-guard', 'cannot zero out total_cents on own booking',
  $s$ update public.bookings set total_cents=0, amount_due_now_cents=0
      where id='cccccccc-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('booking-guard', 'cannot zero platform_fee_cents',
  $s$ update public.bookings set platform_fee_cents=0
      where id='cccccccc-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('review-guard', 'author cannot unpublish own review',
  $s$ update public.reviews set is_published=false
      where id='dddddddd-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('review-guard', 'author cannot write professional_response',
  $s$ update public.reviews set professional_response='fake'
      where id='dddddddd-0000-0000-0000-000000000001' $s$, 'blocked');

-- ============================================================
-- PROFESSIONAL B acting against PROFESSIONAL A
-- ============================================================
set request.jwt.claims = '{"sub":"44444444-4444-4444-4444-444444444444","role":"authenticated"}';

select tst.check_write('professional', 'cannot edit another professional profile',
  $s$ update public.professional_profiles set business_name='STOLEN'
      where user_id='33333333-3333-3333-3333-333333333333' $s$, 'blocked');

select tst.check_write('professional', 'cannot modify another professional service',
  $s$ update public.services set price_cents=1
      where id='aaaaaaaa-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('professional', 'cannot delete another professional service',
  $s$ delete from public.services where id='aaaaaaaa-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('professional', 'cannot modify another professional availability',
  $s$ update public.availability_rules set start_minute=0
      where id='bbbbbbbb-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('professional', 'cannot insert availability for another professional',
  $s$ insert into public.availability_rules(professional_id, weekday, start_minute, end_minute)
      values('33333333-3333-3333-3333-333333333333', 2, 540, 600) $s$, 'blocked');

-- handle_new_user() creates a customer_profiles row for EVERY user, so an
-- unscoped select legitimately returns the caller's own row. Scope to another
-- user's row or the test proves nothing.
select tst.check_read('professional', 'cannot read another user private customer data',
  $q$ select 1 from public.customer_profiles
      where user_id='11111111-1111-1111-1111-111111111111' $q$, 'empty');

select tst.check_read('professional', 'cannot read unrelated bookings',
  $q$ select 1 from public.bookings where professional_id='33333333-3333-3333-3333-333333333333' $q$, 'empty');

-- ============================================================
-- PROFESSIONAL A privilege columns (the CRITICAL finding)
-- ============================================================
-- The privilege attacks run as PRO C, who is pending (is_active=false,
-- is_verified=false). Against an already-approved pro these updates are no-ops
-- that never trip the guard.
set request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';

select tst.check_write('privilege-guard', 'pending pro cannot self-verify (is_verified)',
  $s$ update public.professional_profiles set is_verified=true
      where user_id='66666666-6666-6666-6666-666666666666' $s$, 'blocked');

select tst.check_write('privilege-guard', 'pending pro cannot self-feature (is_featured)',
  $s$ update public.professional_profiles set is_featured=true
      where user_id='66666666-6666-6666-6666-666666666666' $s$, 'blocked');

select tst.check_write('privilege-guard', 'pending pro cannot self-approve (is_active)',
  $s$ update public.professional_profiles set is_active=true
      where user_id='66666666-6666-6666-6666-666666666666' $s$, 'blocked');

select tst.check_write('privilege-guard', 'pending pro cannot zero platform take rate',
  $s$ update public.professional_profiles set take_rate_bps=0
      where user_id='66666666-6666-6666-6666-666666666666' $s$, 'blocked');

select tst.check_write('privilege-guard', 'pending pro CAN edit own business_name',
  $s$ update public.professional_profiles set business_name='Pro C Renamed'
      where user_id='66666666-6666-6666-6666-666666666666' $s$, 'allowed');

-- Remaining privilege/review tests act as PRO A (subject of the review).
set request.jwt.claims = '{"sub":"33333333-3333-3333-3333-333333333333","role":"authenticated"}';

select tst.check_write('privilege-guard', 'CAN still edit own business_name (not over-blocked)',
  $s$ update public.professional_profiles set business_name='Pro A Studio Renamed'
      where user_id='33333333-3333-3333-3333-333333333333' $s$, 'allowed');

select tst.check_write('review-guard', 'subject cannot rewrite review rating',
  $s$ update public.reviews set rating=5
      where id='dddddddd-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('review-guard', 'subject cannot blank review body',
  $s$ update public.reviews set body=null
      where id='dddddddd-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('review-guard', 'subject cannot bury review (is_published)',
  $s$ update public.reviews set is_published=false
      where id='dddddddd-0000-0000-0000-000000000001' $s$, 'blocked');

select tst.check_write('review-guard', 'CAN write professional_response (intended use)',
  $s$ update public.reviews set professional_response='Sorry about that -- refund issued.'
      where id='dddddddd-0000-0000-0000-000000000001' $s$, 'allowed');

select tst.check_write('professional', 'CAN edit own service (not over-blocked)',
  $s$ update public.services set price_cents=13000
      where id='aaaaaaaa-0000-0000-0000-000000000001' $s$, 'allowed');

-- ============================================================
-- APPLICATION MODERATION / RESUBMISSION (0037)
-- ============================================================
reset role;
set role service_role;
set request.jwt.claims = '{"role":"service_role"}';
update public.professional_profiles
set account_status='active', review_status='rejected', reviewed_at=now() - interval '1 minute'
where user_id='66666666-6666-6666-6666-666666666666';
insert into public.professional_documents(
  professional_id, kind, file_path, file_name, mime_type, size_bytes, review_status, created_at
) values (
  '66666666-6666-6666-6666-666666666666', 'id_document',
  '66666666-6666-6666-6666-666666666666/id_document/rls-test.jpg',
  'rls-test.jpg', 'image/jpeg', 3, 'pending', now()
);

set role authenticated;
set request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select tst.check_write('application-0037', 'active rejected owner can atomically resubmit',
  $s$ select public.submit_professional_application('rejected') $s$, 'allowed');

reset role;
set role service_role;
set request.jwt.claims = '{"role":"service_role"}';
update public.professional_profiles
set account_status='suspended', review_status='rejected'
where user_id='66666666-6666-6666-6666-666666666666';

set role authenticated;
set request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select tst.check_write('application-0037', 'suspended owner cannot edit profile directly',
  $s$ update public.professional_profiles set business_name='Suspended edit'
      where user_id='66666666-6666-6666-6666-666666666666' $s$, 'blocked');
select tst.check_write('application-0037', 'suspended owner cannot resubmit through RPC',
  $s$ select public.submit_professional_application('rejected') $s$, 'blocked');

reset role;
set role service_role;
set request.jwt.claims = '{"role":"service_role"}';
update public.professional_profiles
set account_status='banned'
where user_id='66666666-6666-6666-6666-666666666666';

set role authenticated;
set request.jwt.claims = '{"sub":"66666666-6666-6666-6666-666666666666","role":"authenticated"}';
select tst.check_write('application-0037', 'banned owner cannot insert document rows',
  $s$ insert into public.professional_documents(
        professional_id, kind, file_path, file_name, mime_type, size_bytes
      ) values (
        '66666666-6666-6666-6666-666666666666', 'id_document',
        '66666666-6666-6666-6666-666666666666/id_document/banned.jpg',
        'banned.jpg', 'image/jpeg', 3
      ) $s$, 'blocked');
select tst.check_write('application-0037', 'banned owner cannot delete document rows',
  $s$ delete from public.professional_documents
      where professional_id='66666666-6666-6666-6666-666666666666' $s$, 'blocked');

-- ============================================================
-- GUEST (anon)
-- ============================================================
reset role;
set role anon;
set request.jwt.claims = '{"role":"anon"}';

select tst.check_read('guest', 'can read active marketplace professionals',
  $q$ select 1 from public.professional_profiles where is_active $q$, 'nonempty');

select tst.check_read('guest', 'can read services of active professionals',
  $q$ select 1 from public.services $q$, 'nonempty');

select tst.check_read('guest', 'cannot read customer profiles',
  $q$ select 1 from public.profiles $q$, 'empty');

select tst.check_read('guest', 'cannot read customer private data',
  $q$ select 1 from public.customer_profiles $q$, 'empty');

select tst.check_read('guest', 'cannot read bookings',
  $q$ select 1 from public.bookings $q$, 'empty');

select tst.check_read('guest', 'cannot enumerate promo codes',
  $q$ select 1 from public.promo_codes $q$, 'empty');

select tst.check_write('guest', 'cannot create a service',
  $s$ insert into public.services(professional_id, name, duration_minutes, price_cents)
      values('33333333-3333-3333-3333-333333333333','Hacked',60,1) $s$, 'blocked');

select tst.check_write('guest', 'cannot create a booking',
  $s$ insert into public.bookings(customer_id, professional_id, service_id, starts_at, ends_at,
        timezone, location_type, service_name_snapshot, subtotal_cents, total_cents,
        amount_due_now_cents)
      values('11111111-1111-1111-1111-111111111111','33333333-3333-3333-3333-333333333333',
        'aaaaaaaa-0000-0000-0000-000000000001', now()+interval '9 days',
        now()+interval '9 days 1 hour','America/Los_Angeles','studio','x',1,1,1) $s$, 'blocked');

select tst.check_write('guest', 'cannot upload a portfolio item',
  $s$ insert into public.professional_portfolio_items(professional_id, kind, url)
      values('33333333-3333-3333-3333-333333333333','image','https://evil.test/x.jpg') $s$, 'blocked');

select tst.check_write('guest', 'cannot modify a professional profile',
  $s$ update public.professional_profiles set business_name='ANON'
      where user_id='33333333-3333-3333-3333-333333333333' $s$, 'blocked');

-- ============================================================
-- ADMIN / service_role
-- ============================================================
reset role;
set role service_role;
set request.jwt.claims = '{"role":"service_role"}';

select tst.check_write('admin', 'service_role CAN approve a professional',
  $s$ update public.professional_profiles set is_active=true, is_verified=true
      where user_id='44444444-4444-4444-4444-444444444444' $s$, 'allowed');

select tst.check_write('admin', 'service_role CAN adjust take rate',
  $s$ update public.professional_profiles set take_rate_bps=1200
      where user_id='44444444-4444-4444-4444-444444444444' $s$, 'allowed');

select tst.check_read('admin', 'service_role CAN read all bookings',
  $q$ select 1 from public.bookings $q$, 'nonempty');

reset role;
reset request.jwt.claims;

\set QUIET off
