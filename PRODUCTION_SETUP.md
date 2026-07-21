# iGlamHer — Production Setup Runbook

Connecting to live services is a **configuration** step — the code is written and
env-gated. Follow this once; then `npm run verify:live` gates the deploy.

## 0. Accounts to create (the actual blockers)
| Service | Needed for | Env vars |
|---|---|---|
| **Supabase** project | DB, Auth, Storage, Realtime, Cron | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` |
| **Stripe** (+ Connect) | payments, payouts, Apple/Google Pay | `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` |
| **Google/Apple OAuth** | social sign-in | configured in Supabase Auth dashboard |
| **Stripe Identity** or **Persona** | ID + selfie liveness | provider keys (add to verification action) |
| **Sentry** (optional) | error tracking | `SENTRY_DSN` |
| **FingerprintJS** + IP intel (optional) | live fraud signals | client key + API key |

## 1. Supabase
1. Create a project; copy URL + anon + service-role keys into `.env.local` (and your host's env).
2. Enable extensions: `pgcrypto`, `btree_gist`, `postgis`, `pg_trgm`, `pg_cron`, `pg_net` (Database → Extensions).
3. Run migrations in order in the SQL editor:
   `0001 → 0002 → 0003 → 0004 → 0005 → 0006 → 0007`, then `seed.sql`, then `storage-policies.sql`.
4. `npm run db:seed` — creates test accounts + the 12-professional marketplace.
5. Auth → set Site URL + `…/auth/callback` redirect; enable Email, Google, Apple providers.

## 2. Storage
`storage-policies.sql` creates the private `verification-documents` bucket (no public
read; admin signed-URL access, access-logged) and the public `portfolio` bucket
(public read, owner-prefixed write). Objects are AES-256 encrypted at rest.
Optional: app-level envelope encryption before upload — add a KMS key and wrap bytes in `lib/storage/documents.ts`.

## 3. Stripe
1. Add secret + publishable + webhook-signing keys.
2. Enable Connect; onboard professionals (Express accounts) — store `stripe_account_id`.
3. Point the webhook at `/api/stripe/webhook` for `payment_intent.succeeded` / `payment_intent.payment_failed`.
4. Apple/Google Pay ride on `automatic_payment_methods` — no extra code.

## 4. Background jobs
`0007_jobs.sql` schedules SQL routines via `pg_cron` (abandoned-booking cleanup,
verification expiry, reliability rescore). Deploy edge functions for the rest:
`supabase functions deploy booking-reminders payout-processor`, then schedule them
with `pg_cron` + `pg_net` (examples in each function's header).

## 5. Verify + go
```bash
npm run verify:live   # checks DB, migrations, RLS deny, buckets, Stripe key
npm run build
```
`verify:live` must be all-green before promoting to production.

## Still requires a build/integration step after accounts exist
- Verification provider call (Stripe Identity/Persona) in `decideVerificationAction` / a new submit action.
- Live fraud-signal collection (FingerprintJS + IP intel) feeding `scoreFraud`.
- In-app voice (Twilio/LiveKit) — not started; needs provider choice.
- Push (APNs/FCM) dispatch in `booking-reminders` + a device-token table.
