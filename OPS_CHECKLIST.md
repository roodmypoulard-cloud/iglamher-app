# OPS CHECKLIST — Boss actions (Claude can't do these: they need live keys / dashboards)

Updated 2026-07-25. Work through top to bottom; each item says how to verify it.

## 1. Prod database migrations
- [ ] Apply `APPLY_PENDING_0035.sql` (Stripe disputes table). Until applied, dispute
      webhooks are acked-but-dropped (logged, no retry storm) and the admin
      chargeback queue shows empty.
- [ ] Apply `APPLY_PENDING_0036.sql` (reschedule columns). Until applied, the
      "Request a time change" action returns an honest "not available yet" message.
- [ ] Verify migrations 0032–0034 really are applied (claimed but verify once):
      `select column_name from information_schema.columns where table_name='professional_profiles' and column_name in ('neighborhood','hide_exact_pin');`
      and `select 1 from information_schema.tables where table_name='professional_private_locations';`

## 2. Stripe Dashboard
- [ ] Webhook endpoint `https://<domain>/api/stripe/webhook`: subscribe to the FULL
      event list in `docs/LAUNCH_OPS.md` §1 (now includes `account.updated` and the
      five `charge.dispute.*` events). Missing events = silent feature gaps.
- [ ] Enable Connect **1099 tax reporting** (Settings → Connect → Tax reporting).
- [ ] Live E2E once, with a real card, small amounts: deposit checkout → pro
      "Start service" (balance hold) → "Finish service" (capture + transfer) →
      cancel a second test booking to verify refund + hold release.

## 3. Supabase
- [ ] Run `VERIFY_CRON.sql` in the SQL editor — confirms pg_cron is installed, the
      expire/reliability jobs exist, and their last runs succeeded.
- [ ] (Optional, recommended) Provision Upstash Redis and set
      `UPSTASH_REDIS_REST_URL` + `UPSTASH_REDIS_REST_TOKEN` in Vercel env. Rate
      limiting works without it but is per-instance only; with Redis it is
      enforced globally across serverless instances.

## 4. Legal
- [ ] Counsel review of `/legal/terms`, `/legal/privacy`, `/legal/cancellation`
      before anything claims "lawyer-approved" anywhere.

## 5. Featured Recommendations ($2.99/mo)
- [ ] Only when ready to monetize: create the $2.99 Price in Stripe and supply the
      Price ID. Until then admin `is_featured` / `is_recommended` stay manual
      (decision logged in PRODUCT_DECISIONS.md).

## 6. GitHub CI
- [ ] Push to GitHub → the new `.github/workflows/ci.yml` runs lint, typecheck,
      unit tests, and a production build on every push/PR to main. First run
      proves it green; protect `main` on green checks if desired.
