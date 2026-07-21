# iGlamHer — Launch Operations

Deployment, incident runbooks, disaster recovery, and the launch-day checklist.
Owners are placeholders `[OWNER]` — assign before launch.

---

## 1. Deployment target

**Vercel** (recommended, and compatible with this Next.js 16 App Router codebase).
Why: zero-config Next.js builds, per-branch preview URLs (natural staging), edge network,
serverless functions for the API routes + webhook, and first-class env-var management.
Supabase (DB/auth/storage) and Upstash (Redis) are both Vercel-integration partners.

Alternative if you outgrow serverless: a container (Dockerfile) on Fly.io/Render — the app
is stateless, so it scales horizontally behind either.

### Deploy steps (staging = a Vercel Preview / a `staging` project)
1. Push the repo to GitHub; import into Vercel.
2. Set env vars (Vercel → Settings → Environment Variables) per `.env.example`. Use
   **Stripe test keys** and the **staging Supabase** project for the staging environment;
   set `APP_ENV=staging` and `NEXT_PUBLIC_APP_URL=https://<staging-domain>`.
3. Build command `npm run build`, output auto-detected.
4. After first deploy, register the URLs below.

### URLs to register (staging + production separately)
| Where | URL |
|---|---|
| Supabase → Auth → **Site URL** | `https://<domain>` |
| Supabase → Auth → **Redirect URLs** | `https://<domain>/**` |
| Google Cloud → OAuth client → **Redirect URI** | `https://<supabase-ref>.supabase.co/auth/v1/callback` |
| Stripe → Webhooks → **Endpoint** | `https://<domain>/api/stripe/webhook` (events: `payment_intent.succeeded`, `payment_intent.payment_failed`, `payment_intent.canceled`, `charge.refunded`) → copy the signing secret to `STRIPE_WEBHOOK_SECRET` |
| Stripe → Connect → **onboarding return/refresh** | handled in-app: `/pro/payouts?done=1` and `?refresh=1` |

CORS: the app is same-origin (API routes under the app domain); no extra CORS config needed.
`form-action 'self'` + `frame-ancestors 'none'` are enforced via CSP.

---

## 2. Pre-deployment backup checklist (run before EVERY migration)
- [ ] Confirm Supabase automatic backups are enabled (Pro plan → daily + PITR).
- [ ] Take a manual snapshot / `pg_dump` of production immediately before migrating.
- [ ] Verify the snapshot restores in a scratch project (see §5).
- [ ] Apply migrations in a transaction where possible; migrations here are append-only
      and idempotent (guards on `create ... if not exists`, `do $$ ... duplicate_object`).
- [ ] Run `npm run verify:live` and `npm run db:health` after migrating.

## 3. Migration order & safety
Apply `0001 → 0009` in order (they depend on prior objects), then `seed.sql`,
`storage-policies.sql`. All are **append-only and safe on fresh, staging, and production**
DBs — no `drop`/`truncate`/data resets. `0006` adds enum values (`alter type ... add value`),
which cannot run inside a txn block that also *uses* the new value; these migrations never
use new enum values in the same statement, so they're safe. **Rollback:** because migrations
are additive, roll back by restoring the pre-migration backup (§5), not by reversing DDL.

---

## 4. Incident runbooks

### Deployment rollback
Vercel → Deployments → select last-good → **Promote to Production**. (Instant; no rebuild.)
Owner: `[OWNER]`.

### Payment incident (charges failing / webhook errors)
1. Check `/api/stripe/webhook` logs + Sentry for `stripe.handleEvent` errors.
2. Stripe Dashboard → Webhooks → inspect failed deliveries; **Resend** — handler is
   idempotent (dedup via `stripe_events`), so replays are safe.
3. If payments must stop: Admin → set `payments_paused` (checkout blocked; app stays up).
Owner: `[OWNER]`.

### Booking incident (double-books / bad slots)
Double-booking is prevented by the DB exclusion constraint; a report means a data anomaly.
Pause new bookings: Admin → `bookings_paused`. Investigate `booking_status_events`.
Owner: `[OWNER]`.

### Provider payout incident
Freeze a provider's payouts: Admin dispute action → `freeze_payout` (sets `payouts_frozen`).
The payout job skips frozen accounts. Payouts require `connect_payouts_enabled` (from Stripe).
Owner: `[OWNER]`.

### Account compromise
Supabase → Auth → revoke the user's sessions / reset password. Review `audit_logs` for the
actor. Rotate `SUPABASE_SERVICE_ROLE_KEY` if a server secret may be exposed (§6).
Owner: `[OWNER]`.

### Service outage
Enable `maintenance_mode` (Admin). Check Vercel + Supabase status pages. Health: `/api/health`.
Owner: `[OWNER]`.

### Customer refund
Stripe Dashboard → Payment → Refund (full/partial). The `charge.refunded` webhook records
the refund + posts a negative earnings-ledger adjustment automatically.
Owner: `[OWNER]`.

### Credential rotation
Rotate in the provider dashboard → update Vercel env → redeploy. Order: Supabase service key,
Stripe secret + webhook secret (re-copy after rotating the endpoint), OAuth client secret.
Never commit secrets. `.env.local` is gitignored.
Owner: `[OWNER]`.

---

## 5. Disaster recovery

- **Backups:** Supabase daily automated backups + **Point-in-Time Recovery** (Pro plan).
- **RPO (max data loss):** ≤ 24h on daily backups; minutes with PITR. Target: **PITR on**.
- **RTO (max downtime):** ≤ 1h (restore to a new project + repoint `NEXT_PUBLIC_SUPABASE_URL`).
- **Restore procedure (TESTED in a scratch project, not prod):**
  1. Supabase → create a new project → restore from backup/PITR timestamp.
  2. Run `npm run db:health` against it.
  3. Point a preview deploy's env at the restored project; smoke-test login + a booking.
  4. Repoint production env + redeploy.
- **Backup verification:** monthly, restore the latest backup to a scratch project and run
  `db:health`. The backup plan is not "done" until this restore has been performed once.

---

## 6. Launch-day checklist

**Pre-launch (T-1 day)**
- [ ] `APP_ENV=production`, all required env vars set, `checkEnv().ok === true`.
- [ ] Migrations `0001–0009` + seed + storage policies applied to production DB.
- [ ] Stripe **live** keys + webhook endpoint registered; `verify:live` green.
- [ ] Google (and Apple, if used) OAuth production redirect URIs registered.
- [ ] Sentry DSN set; a test error appears in Sentry.
- [ ] Redis (Upstash) configured; `/api/health` shows it connected.
- [ ] Backups + PITR enabled; one restore rehearsal done.
- [ ] Beta config set (`beta.invite_only` if invite-only); access codes seeded.
- [ ] Legal pages reviewed by counsel.

**Launch day**
- [ ] Deploy to production; `/api/health` → `ok`.
- [ ] Smoke: register → verify email → book → **real test payment** → confirm → message.
- [ ] Provider: onboard → set service/availability → Connect payout onboarding.
- [ ] Admin: approve a provider, view analytics, toggle `bookings_paused` on/off.
- [ ] Watch Sentry + Vercel logs for 60 min.

**Post-launch**
- [ ] Verify first real booking + payout reconcile.
- [ ] Review `audit_logs`, fraud flags, dispute queue daily for the first week.
