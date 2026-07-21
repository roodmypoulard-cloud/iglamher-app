-- ============================================================
-- iGlamHer — 0007 Background jobs (SQL routines + pg_cron schedules)
-- Self-contained maintenance runs; reminder/payout jobs that need Stripe or
-- push are handled by edge functions (see supabase/functions/*), scheduled the
-- same way. Requires pg_cron (+ pg_net for edge invocation) enabled in Supabase.
-- Append-only: assumes 0001–0006 applied.
-- ============================================================

-- ---------- routines ----------

-- Abandoned-booking cleanup: release slots held by unpaid drafts after 30 min.
create or replace function public.expire_stale_pending_bookings() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with expired as (
    update public.bookings
       set status = 'cancelled_customer',
           cancelled_at = now(),
           cancellation_reason = 'Abandoned — payment not completed'
     where status = 'pending_payment'
       and created_at < now() - interval '30 minutes'
    returning id
  )
  insert into public.booking_status_events (booking_id, status, note)
  select id, 'cancelled_customer', 'Auto-cancelled: abandoned booking' from expired;
  get diagnostics n = row_count;
  return n;
end; $$;

-- Verification expiry: flag verifications whose expires_at has passed.
create or replace function public.expire_verifications() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  update public.professional_verifications
     set status = 'more_info_requested',
         requested_info = 'Verification expired — please re-submit documents',
         updated_at = now()
   where status = 'approved' and expires_at is not null and expires_at < now();
  get diagnostics n = row_count;
  update public.professional_profiles p set is_verified = false
   from public.professional_verifications v
   where v.professional_id = p.user_id and v.status = 'more_info_requested' and v.expires_at < now();
  return n;
end; $$;

-- Reliability rescore: recompute cancellation_rate + reliability_score from bookings.
create or replace function public.recompute_reliability() returns integer
language plpgsql security definer set search_path = public as $$
declare n integer;
begin
  with stats as (
    select professional_id,
           count(*) filter (where status = 'completed')::numeric as completed,
           count(*) filter (where status in ('cancelled_professional'))::numeric as pro_cancelled,
           count(*) filter (where status in ('completed','cancelled_professional','no_show','confirmed','in_progress'))::numeric as total
    from public.bookings group by professional_id
  )
  update public.professional_profiles p
     set cancellation_rate = case when s.total > 0 then round(100 * s.pro_cancelled / s.total, 2) else 0 end,
         completion_rate    = case when s.total > 0 then round(100 * s.completed / s.total, 2) else 0 end,
         reliability_score  = greatest(0, least(100,
            round(80
                  + (case when s.total > 0 then 20 * s.completed / s.total else 0 end)
                  - (case when s.total > 0 then 40 * s.pro_cancelled / s.total else 0 end))::int))
    from stats s where s.professional_id = p.user_id;
  get diagnostics n = row_count;
  return n;
end; $$;

-- ---------- schedules (no-op if pg_cron is not installed) ----------
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.schedule('expire-stale-bookings', '*/10 * * * *', 'select public.expire_stale_pending_bookings();');
    perform cron.schedule('expire-verifications',  '0 3 * * *',    'select public.expire_verifications();');
    perform cron.schedule('recompute-reliability', '0 * * * *',    'select public.recompute_reliability();');
  end if;
exception when others then
  raise notice 'pg_cron not available; schedule these jobs manually or via edge functions.';
end $$;
