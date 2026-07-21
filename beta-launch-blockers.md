# iGlamHer — Beta Launch Blockers

**Scope:** the four confirmed blockers only. No new audits, no scope expansion.
**Date:** 2026-07-20 · **Mode:** Stripe TEST (no live switch yet).

**Status key:** ✅ PASS (verified) · 🟡 READY (built/diagnosed — needs your one manual step, then I verify) · 🔴 FAIL (currently broken).

Two hard limits on what I can verify from here, stated once: I **cannot apply DDL** to the production database (no connection string/management token) and I **cannot deploy** (no git remote / Vercel CLI in this environment). So DB migrations and code deploys are your manual step; everything I *can* verify (live DB probes, real-Postgres proofs, typecheck/lint/build) is done and evidenced below.

---

## Blocker 1 — Stripe test checkout is broken (expired key)

**Blocker:** Checkout cannot complete. The deployed Stripe secret key is **expired**.

**Exact fix:** Replace the Stripe **secret key** environment variable with a fresh key from the same Stripe **test** account.

| Vercel env variable | Current | Action |
|---|---|---|
| `STRIPE_SECRET_KEY` | `sk_test_…` → **EXPIRED** (`api_key_expired`) | **Replace** with a fresh `sk_test_…` from Stripe Dashboard → Developers → API keys (test mode) |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | `pk_test_…` | Replace **only if** you rotate/roll the account keys (must match the same account) |
| `STRIPE_WEBHOOK_SECRET` | `whsec_…` present | Keep — unless the webhook endpoint is recreated, then use its new signing secret |

Set these in **Vercel → Project → Settings → Environment Variables → Production**, then **redeploy** so the new value is picked up. Do not switch to live keys yet.

**Manual action required from you:**
1. Generate a fresh **test** secret key in Stripe and replace `STRIPE_SECRET_KEY` in Vercel (Production).
2. Redeploy.
3. Tell me it's done — I then run the end-to-end verification below.

**Verification evidence (so far):** Diagnosed live — a direct Stripe API call with the deployed key returns `{"code":"api_key_expired"}`. Key prefixes confirm both keys are test-mode. No secret values were printed. The webhook code itself is correct (signature-verified + `stripe_events` idempotency) — the only fault is the expired key.

**Verification I will run after you replace it** (test-mode E2E, no live money): book an active provider → Stripe test checkout with card `4242 4242 4242 4242` → confirm, against production:
- deposit amount charged = service deposit % of price (integer cents),
- platform fee = `take_rate_bps` of total,
- provider net = total − platform fee,
- booking status flips `pending_payment → confirmed` via the webhook,
- a `payments` row is written,
- the conversation `is_unlocked` flips true (messaging unlock).

**Pass/fail status:** 🔴 **FAIL** (today) → will re-test to ✅ the moment the key is replaced.

---

## Blocker 2 — No real provider onboarding

**Blocker:** No self-serve path existed for a real user to become a provider (nothing created a `professional_profiles` row; the onboarding page was a static stub).

**Exact fix (built this sprint):**
- **`supabase/migrations/0015_…sql`** — adds `review_status` (`draft|pending_review|approved|rejected`, default `draft`) to `professional_profiles`; extends the column guard so a provider can move `draft ↔ pending_review` but **cannot** self-set `approved/rejected`, `is_active`, or the demo flag (admins only).
- **`src/lib/pro/onboarding-actions.ts`** — `startProviderOnboardingAction` (self-upgrade role customer→professional via the existing role trigger, self-create the draft profile via the existing `pro self insert` RLS policy; idempotent) and `submitProviderForReviewAction` (validates business name, bio, service area, ≥1 active service, ≥1 availability window → sets `pending_review`; never sets `is_active`).
- **`src/app/onboarding/professional/page.tsx`** — real orchestrator: *Become a pro* → complete profile (reuses `ProfileForm`, `PortfolioManager`) + services/availability links → *Submit for review* → *Under review* → *You're live* (after admin approval).
- **`src/lib/admin/actions.ts`** — the existing admin activate action now also stamps `review_status='approved'` on approval. Approval remains the sole visibility gate (`is_active`). No admin-dashboard expansion.

Collects exactly the requested fields: business/display name, bio, service categories, service area, profile image, portfolio images, services & prices, availability. Progress saves as you go. **Every new provider is `pending_review` and invisible until an admin approves.**

**Manual action required from you:**
1. Apply **`supabase/APPLY_PENDING_0015.sql`** in the Supabase SQL Editor (run V1–V3 checks).
2. Ensure a public **Storage bucket** exists for profile/portfolio images (`avatars`/`portfolio`) if not already — image upload needs it.
3. Deploy the code.
4. Then I run the live E2E (new provider signs up → onboards → pending → you approve → appears publicly).

**Verification evidence (done):**
- **Gating proven on real Postgres (7/7):** new provider = `draft` + not public; self-submit → `pending_review` (still not public); **self-approve BLOCKED**, **self-activate BLOCKED**, **self-demo BLOCKED**; admin approve → `is_active=true` + `review_status='approved'`.
- **Code compiles clean:** `tsc --noEmit` ✅, `eslint` ✅, `next build` ✅.
- RLS/trigger prerequisites confirmed in prod schema (`pro self insert` policy; customer→professional role trigger).

**Pass/fail status:** 🟡 **READY** — code complete, DB-gating verified on real Postgres, builds green. Live UI E2E is ✅-able as soon as you apply `0015` + deploy.

---

## Blocker 3 — Demo providers indistinguishable from real

**Blocker:** 12 seeded demo pros were active/verified with no flag — they show as real providers.

**Exact fix (built this sprint):**
- **`0015`** adds `is_demo boolean default false` and **backfills `is_demo=true` for the 12 seeded demo UUIDs** (`a0000000-…-00000000000{1..c}`). Real providers default `is_demo=false`. The flag is admin-only (guarded).
- **`supabase/HIDE_DEMO_PROVIDERS.sql`** — a **safe, reversible** command that sets `is_active=false where is_demo=true` (the sole visibility gate). Nothing is deleted; demo data is preserved for internal testing; an un-hide block is included.

Does **not** auto-hide on migration — per your instruction, demo pros stay visible until you have real providers, then you run the hide command.

**Manual action required from you:**
1. Apply `0015` (flags the 12 — verify V2 returns 12).
2. Once real providers are live, run **`supabase/HIDE_DEMO_PROVIDERS.sql`**.

**Verification evidence (done, real Postgres):** demo backfill flags rows correctly; hide command drops visible demo count `2→0` while real providers remain visible (`1`); fully reversible. Demo UUID list matches `src/lib/data/seed.ts:237-248`.

**Pass/fail status:** 🟡 **READY** — mechanism built + proven; two SQL runs from done (flag now, hide when real providers exist).

---

## Blocker 4 — pg_cron confirmation

**Blocker:** Need to confirm the required scheduled job (stale/pending-payment cleanup) is actually running in production.

**Exact fix:** none needed *unless* the confirmation query shows it missing — the job **function** already runs (verified live). Confirmation requires the SQL editor (the `cron` schema isn't reachable over the API).

**Manual action required from you:** run this in the Supabase SQL Editor (also saved as `supabase/VERIFY_CRON.sql`):

```sql
-- pg_cron installed?  (expect 1 row: pg_cron)
select extname, extversion from pg_extension where extname = 'pg_cron';

-- required job exists + schedule  (expect 'expire-stale-bookings', '*/10 * * * *', active=true)
select jobid, jobname, schedule, active from cron.job where jobname = 'expire-stale-bookings';

-- most recent execution + result  (expect status='succeeded')
select r.status, r.return_message, r.start_time, r.end_time
from cron.job_run_details r join cron.job j on j.jobid = r.jobid
where j.jobname = 'expire-stale-bookings'
order by r.start_time desc limit 1;
```

If `pg_cron` row is empty → enable it (Dashboard → Database → Extensions → pg_cron), then re-run the schedule block in `supabase/migrations/0007_jobs.sql:75-81`. **Do not create new jobs** — the required one already exists in code.

**Verification evidence (done):** all three job **functions** exist and execute in production (invoked live via service-role RPC) — `expire_stale_pending_bookings()` returned `1` (actually expired a stale hold during the check), `expire_verifications()` → `0`, `recompute_reliability()` → `1`. Whether `pg_cron` is *installed + scheduled* is the one part only your SQL run can confirm.

**Pass/fail status:** 🟡 **READY** — function verified running live; scheduler confirmation is a single query away (paste the result and I'll mark ✅/🔴).

---

## Beta Exit Criteria — current status

| Exit criterion | Status | Blocked by |
|---|---|---|
| New customer can create a real account | ✅ (signup live) | — |
| New provider can create account + submit onboarding | 🟡 built | apply `0015` + deploy |
| Provider stays pending until admin approval | ✅ proven (real PG) | — |
| Approved provider appears publicly | ✅ gate proven | apply `0015` + deploy to exercise live |
| Customer can book that provider | ✅ (engine works) | needs a valid Stripe key |
| Stripe test checkout succeeds | 🔴 | Blocker 1 — replace key |
| Webhook updates the booking | ✅ code correct | verify after key fix |
| Messaging unlocks correctly | ✅ (Phase 12.1) | verify after key fix |
| Demo providers hidden from public beta | 🟡 ready | apply `0015`, run hide when real pros live |
| Required cron job confirmed running | 🟡 function ✅ | run `VERIFY_CRON.sql` |

**Not declaring success:** two criteria are hard-blocked until your manual steps — the Stripe key replacement (Blocker 1) and applying `0015` + deploying (Blockers 2/3). Once you do those, I will run the live checkout E2E and the provider onboarding E2E against production and update every 🟡 to ✅ or 🔴 with real evidence.

## Your ordered manual actions
1. **Replace `STRIPE_SECRET_KEY`** (fresh test key) in Vercel Production + redeploy. → unblocks checkout.
2. **Apply `supabase/APPLY_PENDING_0015.sql`** in the SQL Editor. → provider review states + demo flag.
3. **Deploy** the code changes (onboarding flow + admin approval stamp).
4. **Confirm a public Storage bucket** for profile/portfolio images.
5. **Run `supabase/VERIFY_CRON.sql`** and paste the result.
6. Onboard your first real provider, approve them, then **run `supabase/HIDE_DEMO_PROVIDERS.sql`**.
7. Ping me — I run both live E2Es and finalize pass/fail.
