-- =============================================================================
-- iGlamHer — Production cron verification (Phase 13)
-- Run in the Supabase SQL Editor. Read-only; changes nothing.
-- I cannot reach the `cron` schema over PostgREST, so these confirm the parts
-- of background-job health that require the SQL editor / dashboard.
-- =============================================================================

-- C1) pg_cron installed?  (expect 1 row: pg_cron)
select extname, extversion from pg_extension where extname in ('pg_cron','pg_net');

-- C2) the three schedules registered?  (expect 3 rows, all active=true)
select jobid, schedule, jobname, active, command
from cron.job
where jobname in ('expire-stale-bookings','expire-verifications','recompute-reliability')
order by jobname;

-- C3) recent run health — any FAILURES in the last 50 runs?  (expect status='succeeded')
select j.jobname, r.status, r.return_message, r.start_time
from cron.job_run_details r
join cron.job j on j.jobid = r.jobid
where j.jobname in ('expire-stale-bookings','expire-verifications','recompute-reliability')
order by r.start_time desc
limit 50;

-- C4) the job FUNCTIONS exist (independent of scheduling)  (expect 3 rows)
select p.proname
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public'
  and p.proname in ('expire_stale_pending_bookings','expire_verifications','recompute_reliability')
order by p.proname;

-- ============================ EXPECTED =======================================
-- C1 -> pg_cron present (pg_net optional). If EMPTY: extension not installed —
--       enable it (Dashboard → Database → Extensions → pg_cron), then re-run
--       the schedule block from migration 0007_jobs.sql (lines 75-81).
-- C2 -> 3 active jobs. If EMPTY but C1 present: schedules were never registered
--       (0007 ran before pg_cron existed) — re-run 0007's cron.schedule block.
-- C3 -> rows all status='succeeded'. Any 'failed' -> read return_message.
-- C4 -> 3 functions (already verified present via RPC on 2026-07-20).
-- =============================================================================
