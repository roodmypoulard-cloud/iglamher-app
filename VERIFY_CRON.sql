-- VERIFY_CRON.sql — run in the Supabase SQL editor (prod) to confirm the
-- pg_cron jobs from 0007/0017 actually exist and are running.
-- Expected jobs: expire-stale-bookings (*/10 min), expire-verifications (03:00),
-- recompute-reliability (hourly), plus any 0017 account-status job.

-- 1. Is pg_cron installed at all? (no rows = not installed — jobs never run)
select extname, extversion from pg_extension where extname = 'pg_cron';

-- 2. What's scheduled?
select jobid, jobname, schedule, command, active from cron.job order by jobname;

-- 3. Did the last runs succeed? (empty = never ran)
select j.jobname, d.status, d.return_message, d.start_time
from cron.job_run_details d
join cron.job j using (jobid)
order by d.start_time desc
limit 20;

-- 4. Spot-check the jobs' effects:
--    stale pending_payment bookings older than the expiry window should be zero.
select count(*) as stale_pending
from public.bookings
where status = 'pending_payment' and created_at < now() - interval '2 hours';
