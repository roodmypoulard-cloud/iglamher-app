# iGlamHer — Launch Readiness Report (Phase 13)

**Production URL:** https://iglamher-app.vercel.app
**Report date:** 2026-07-20
**Focus:** Operational readiness for a controlled beta — background jobs, Stripe live readiness, provider onboarding, admin tooling, observability, security.

**Evidence legend:** ✅ verified against live production · 🧾 verified in code (not runtime) · 🔑 requires a credential I must not handle · 🖥️ requires an operator dashboard/SQL editor · ⛔ blocked/couldn't verify · ❌ failed.

---

## 0. Executive Verdict

# 🟠 NOT READY FOR CONTROLLED BETA today — 4 operator items away

The **software core is beta-grade**: messaging works end-to-end (Phase 12.1), security is genuinely strong (RLS, authz, secrets, redirects, privilege-escalation all pass — verified live), background-job routines run, and the admin analytics + booking/payment engine are real. Nothing below is a code-quality failure.

What blocks a controlled beta is **operational, not architectural**:

1. **🔴 Payments are not currently functional.** The only Stripe secret key I can see (in the deployed env file) is an **expired test key** (`api_key_expired`). Until a valid key is in place, no checkout can complete. (§2)
2. **🔴 No real provider can join.** There is **no self-serve onboarding** — nothing creates a `professional_profiles` row for a real user. The marketplace has no supply on-ramp. (§3)
3. **🔴 The current "providers" are fake.** 12 seeded demo pros are live, active, and verified with **no demo flag** — indistinguishable from real providers. (§3)
4. **🟠 `pg_cron` scheduling is unconfirmed.** The job *functions* run (verified live), but I cannot confirm from here that `pg_cron` is installed and the 3 schedules are registered — if not, stale unpaid holds never auto-expire. (§1)

None of these require new architecture. They are: refresh/activate Stripe, seed the first providers (manually for a small beta) + remove/flag demo data, and confirm one extension. After those four, **controlled beta is a GO**. **Public launch** additionally needs self-serve onboarding, the admin trust-&-safety UI, real error monitoring, and a live Stripe end-to-end payout (§ verdicts at bottom).

---

## 1. Background Jobs

**✅ Verified live (via service-role RPC, 2026-07-20):** all three job routines exist and execute correctly.

| Job function | Purpose | Live result |
|---|---|---|
| `expire_stale_pending_bookings()` | Booking expiration / **pending-payment & abandoned-checkout cleanup** | ✅ returned `1` — actually expired a stale hold during the probe |
| `expire_verifications()` | Expire pending provider verifications | ✅ returned `0` (none due) |
| `recompute_reliability()` | Recompute provider reliability scores | ✅ returned `1` |

- **Booking / pending-payment / abandoned-checkout cleanup** are all the *same* job (`expire_stale_pending_bookings`, scheduled `*/10 * * * *`) — confirmed working. 🧾 `supabase/migrations/0007_jobs.sql:76`
- **Loyalty maintenance jobs: N/A by design.** There is no loyalty cron and none is needed — loyalty is event-driven (atomic `redeem_loyalty_points` RPC on redemption, accrual on booking events). Not a gap. 🧾 grep of all `cron.schedule` calls returns exactly the 3 above.

**⛔ Cannot verify from here (needs operator SQL):** whether `pg_cron` is *installed* and whether the 3 schedules are *registered* with no failed runs. The `cron` schema isn't exposed over PostgREST (`PGRST205`). The schedule block is a **no-op if `pg_cron` is absent** (`0007_jobs.sql:75` guards on `pg_extension`), so this is a real unknown.

**→ Operator action:** run `supabase/VERIFY_CRON.sql` (C1–C4). Expected: `pg_cron` present, 3 active jobs, all recent runs `succeeded`. If C1 is empty, enable the extension and re-run `0007`'s schedule block.

---

## 2. Stripe Live Readiness

| Item | Status | Evidence |
|---|---|---|
| Publishable key | 🧾 **TEST** | `pk_test_…` in env |
| Secret key | ❌ **TEST + EXPIRED** | `sk_test_…`; live API call → `api_key_expired`. **Payments cannot work until refreshed.** |
| Webhook secret | 🧾 present | `STRIPE_WEBHOOK_SECRET` set |
| Webhook signature verification | ✅ 🧾 | `constructEvent` + `stripe_events` dedup/idempotency — `src/app/api/stripe/webhook/route.ts` |
| Webhook endpoint registered in Stripe | ⛔ | Couldn't enumerate — the expired key errors the `webhook_endpoints` list call |
| Stripe Connect onboarding | 🧾 PRESENT | Express onboarding: `startConnectOnboardingAction` → `ensureConnectAccount` + `createOnboardingLink` (`src/lib/payments/connect-actions.ts:22`) |
| Connected account status gating | ✅ 🧾 | Payouts gated on DB columns `stripe_account_id, connect_payouts_enabled, payouts_frozen` (`src/lib/payments/payouts.ts:50-57`) |
| Platform fee calculation | ✅ 🧾 | Server-side; `payoutAmountCents = total − platformFee` (`src/lib/payments/split.ts`, unit-tested) |
| Provider payout calculation | 🧾 PRESENT (dormant) | `transferBookingPayout` separate charges+transfers; no-ops until Connect eligible + live keys |
| Refund handling | ✅ 🧾 | `charge.refunded` → `reverseBookingPayout` proportional reversal |
| Partial refund handling | ✅ 🧾 | `fullyRefunded = refunded===true || amount_refunded>=amount` (Phase 10 fix) |
| **⚠️ Partial-deposit payout math** | 🧾 GAP | Payout derived from full service total; over-pays on deposit-only services. Safe for full-payment only. Fix before live payouts. |

**Exact go-live checklist (operator, Stripe dashboard):**
1. **Refresh the Stripe key immediately** — even test-mode beta needs a valid key. Confirm the *production Vercel* `STRIPE_SECRET_KEY` is valid (I can only see the env file's expired one; I cannot read prod secret values or the Stripe dashboard).
2. For real money: create **live** keys → set `STRIPE_SECRET_KEY`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (live) in Vercel Production.
3. Register the **live webhook** endpoint (`/api/stripe/webhook`) with events `payment_intent.succeeded/canceled`, `charge.refunded`, `account.updated`; put its signing secret in `STRIPE_WEBHOOK_SECRET`.
4. Enable **Connect** (Express) on the live account; onboard one real provider; confirm `charges_enabled`/`payouts_enabled`.
5. **Fix the partial-deposit payout math** before enabling deposit-based payouts.
6. Run one **live** end-to-end: book → pay → complete → payout → refund; verify in the Stripe dashboard.

---

## 3. Provider Onboarding & Demo Data

**🔴 There is no working self-serve provider onboarding.** A real user cannot become a provider through the app.

| Onboarding step | Status | Evidence |
|---|---|---|
| Entry / "Become a pro" flow | ❌ **stub** | `src/app/onboarding/professional/page.tsx` — static checklist, `currentStep=1` hardcoded, no forms/persistence; no CTA links to it |
| **`professional_profiles` row creation** | ❌ **MISSING (hard blocker)** | No insert/upsert anywhere in `src/`; no `handle_new_user` trigger. Only `scripts/seed.ts:82` creates rows. Real users hit "No professional profile found" (`src/app/pro/profile/page.tsx:13`) |
| Identity (name/business/bio/location) | 🧾 PARTIAL | `saveProfileAction` **updates** an existing row only (`src/lib/pro/actions.ts:159`) |
| Portfolio images (upload) | ❌ **stub** | `PortfolioManager.tsx:24` validates then says "wires up with a connected Supabase project" — never stored |
| Services + pricing | 🧾 PARTIAL | `saveServiceAction` real (`actions.ts:34`), but only for pros with a row |
| Availability | 🧾 PARTIAL | `saveAvailabilityAction` real (`actions.ts:93`), same caveat |
| Stripe Connect onboarding | 🧾 PRESENT | `connect-actions.ts:22` (real Express) |
| Approval workflow | 🧾 PRESENT (admin side) | Pros can't self-activate (`is_active` excluded, `actions.ts:140`); admin `setProfessionalActiveAction` flips it. Default `is_active=false` (`0001_schema.sql:64`) |

**Marketplace visibility gate:** solely `is_active = true` (`src/lib/data/professionals.ts:150,198,217,274`). `is_verified` is a trust badge, **not** a visibility filter. Sound gate — but nothing creates activatable real pros.

**🔴 Demo data — 12 seeded pros, no flag.** Defined in `src/lib/data/seed.ts` (UUIDs `a0000000-…-0000000000{1..c}`), written by `scripts/seed.ts` with `is_active=true, is_verified=true`. **No `is_demo` column exists** — against the live DB they are indistinguishable from real providers and appear in discover/search.

**→ Options (choose per launch plan):**
- **Hide fast:** `update professional_profiles set is_active=false where user_id in (P1..P12)` (or `email ilike '%@pro.iglamher.test'`) — removes from all public queries via the gate.
- **Remove fully:** `delete from professional_profiles where user_id in (…)` — children cascade — then delete the auth users.
- **Proper fix:** add `is_demo boolean default false`, set in seed, add `.eq("is_demo", false)` to the visibility queries so demo data can never leak.

**Beta strategy recommendation:** a controlled invite beta does **not** require self-serve onboarding. **Manually onboard the first 5–10 real providers** (operator creates the profile rows / role=professional, or I build a minimal admin "create provider" path), remove/flag the demo pros, and defer the full self-serve flow to a public-launch milestone.

⚠️ Deactivating demo pros with no real replacements leaves the marketplace **empty** — sequence demo removal *with* real-provider onboarding. This is a product decision; I did not execute it unilaterally.

---

## 4. Admin Dashboard

Only 3 admin pages exist: `src/app/admin/{page, analytics/page, campaigns/page}.tsx`.

| Capability | Status | Evidence |
|---|---|---|
| Approve providers | 🟠 PARTIAL | `src/lib/admin/actions.ts:23` — toggles `is_active`, not verification |
| Suspend providers | 🟠 PARTIAL | `AdminProRow.tsx:22` — deactivate only; freeze/suspend backend unwired |
| View bookings | ❌ MISSING | no admin bookings list |
| View payouts | ❌ MISSING | `payout_transfers` ledger exists, zero admin reads |
| View disputes | 🟠 PARTIAL | `src/lib/admin/data.ts:95` — read-only queue; resolve action unwired |
| View reports | 🟠 PARTIAL | `src/lib/admin/data.ts:78` — read-only queue; resolve action unwired |
| View platform analytics | ✅ PRESENT | `src/lib/analytics/data.ts:19` — real GMV/funnel/retention |
| Search users | ❌ MISSING | none |
| Search bookings | ❌ MISSING | none |

**Notable:** `trust-actions.ts` (resolveDispute/resolveReport, verification approve, account freeze) is **fully built and audit-logged but has zero UI callers** — the backend exists, the buttons don't.

**Access control:** ✅ Not middleware (`src/middleware.ts:4` omits `/admin`), but per-page `requireAdminPage()` (`src/lib/admin/require-admin-page.ts:13`, checks `profiles.role==='admin'` else redirect) **and** per-action `requireAdmin()` re-check (`actions.ts:13`, `trust-actions.ts:13`). **Non-admins are blocked in production.** Caveat: in non-live/preview mode (`!isLiveSupabase()`) admin page *reads* skip the auth check (`require-admin-page.ts:8`) — not exploitable in prod (writes still blocked, prod is live-Supabase).

---

## 5. Observability

| Capability | Status | Evidence |
|---|---|---|
| Error monitoring | 🟠 PARTIAL | `src/lib/observability/logger.ts:26` — Sentry forward **stubbed/commented**, console only; no DSN consumed |
| API error logging | 🟠 PARTIAL | only the webhook captures; e.g. `src/app/api/recommendations/route.ts` has no try/catch |
| Payment logging | ✅ PRESENT | webhook `captureError` + info (`webhook/route.ts:57`) — but `payment_failed` path unlogged |
| Booking failure logging | ❌ MISSING | `src/lib/booking/actions.ts:90` — errors returned to UI, never logged |
| Auth failure logging | ❌ MISSING | `src/lib/auth/actions.ts:55` — sign-in errors returned, never captured |
| Performance monitoring | ❌ MISSING | `src/lib/analytics.ts:35` — `console.debug` placeholder, no web-vitals sink |
| Health endpoint | 🟠 PARTIAL | `src/app/api/health/route.ts:13` — checks **config presence only**, no live DB/Stripe ping (so its `payments:true` does *not* prove the Stripe key works) |

**🟠 PII-in-logs:** `src/lib/integrations/notifications.ts:51` logs recipient email (`to: p.email`). **No secret/token/Stripe-object leaks found**; the messaging path logs nothing. → Drop or hash the email. (Quick, safe fix — I can apply it on request.)

**Rate limiting:** in-memory only, applied at `recommendations/route.ts:13`, `search/suggest/route.ts:13`, and auth via `src/lib/security/guard.ts:19`. The **distributed** `redisRateLimit` (`src/lib/cache/redis.ts:79`) is **defined but never called** — so limits don't hold across serverless instances, and messaging/booking are uncovered.

---

## 6. Security Audit

**Overall: strong.** Independently verified against live production where possible.

| Area | Status | Evidence |
|---|---|---|
| RLS on sensitive tables | ✅ PASS | **Live:** anon reads of `payments, loyalty_accounts, loyalty_transactions, account_credits, reviews, bookings, profiles` all return **0 rows**; anon `insert` into `reviews` blocked (`P0001 "review allowed only for your completed booking"`). Messaging/payout/referral verified in Phase 12. |
| No exposed secrets | ✅ PASS | `.env*` gitignored; no `sk_`/service-role committed |
| Protected API routes | ✅ PASS | mutating routes authed; webhook uses signature |
| Protected server actions | ✅ PASS | `auth.getUser()` + ownership before mutation |
| Authorization enforcement | ✅ PASS | `is_admin()` / role checks; amounts server-computed |
| Rate limiting | 🟠 WEAK | in-memory only; distributed helper unused; messaging/booking uncovered (§5) |
| File upload validation | 🟠 WEAK | verification docs validated (`src/lib/storage/documents.ts`); portfolio upload is a stub (§3) |
| Input validation | ✅ PASS | Zod schemas across actions (`src/lib/pro/schemas.ts`, etc.) |
| Secure redirects | ✅ PASS | open-redirect guard on `next` params |
| Privilege escalation | ✅ PASS | `prevent_role_escalation` trigger (`0002_functions.sql:52`); pros can't self-activate |

**⚠️ Correctness item to verify (flagged by the security pass):** the booking status flow — pro accept/start/complete writes go through the user's RLS client while a column guard restricts non-privileged writers from setting `confirmed/in_progress/completed`. Confirm a provider can actually advance a booking end-to-end (test on staging/beta before relying on it).

---

## 7. Beta Readiness Checklist

**Remaining blockers (must clear before inviting anyone):**
- [ ] 🔑 Valid Stripe key in production (refresh test key, or go live). **Payments are dead until this is done.**
- [ ] 🖥️ Remove/flag the 12 demo providers **and** onboard the first real providers (manual for beta).
- [ ] 🖥️ Confirm `pg_cron` + 3 schedules (`VERIFY_CRON.sql`).
- [ ] 🟠 Fix the PII email log (`notifications.ts:51`).

**Manual operator actions:**
- [ ] Apply nothing further in DB migrations — `0011`–`0014` are already applied/verified.
- [ ] Verify the booking-status advance flow works for a provider (§6).
- [ ] Decide beta cohort size and provider list.

**Live Stripe activation:** see §2 checklist (steps 1–6).

**First provider onboarding (beta, operator-assisted):**
1. Create the user (role `professional`) + `professional_profiles` row (script or a minimal admin action).
2. Provider fills profile, services, pricing, availability (these dashboard forms work).
3. Provider completes Stripe Connect onboarding (`connect-actions` — needs live/valid Stripe).
4. Admin flips `is_active=true` to make them visible.
5. Portfolio images: upload is stubbed — set cover/images via storage manually until wired.

**First customer onboarding:**
1. Sign up → `/onboarding/customer` (works).
2. Browse discover → real providers only (after demo removal).
3. Book → deposit checkout (needs valid Stripe) → conversation auto-created (Phase 12.1 ✅) → message provider.

**Rollback plan:**
- Code: Vercel instant rollback to last-good deployment.
- Demo removal is reversible (`is_active=true` to restore).
- Stripe live→test: revert env vars + redeploy; reconcile in-flight charges in dashboard.
- Kill switch: `isBookingsPaused()` halts new bookings without a redeploy.
- Snapshot the DB before demo removal and before any live-payment switch.

**First-48-hours monitoring:**
- [ ] `/api/health` green (add an uptime ping).
- [ ] Watch Vercel function logs for errors (no Sentry yet — logs are the only sink).
- [ ] Stripe dashboard: every `payment_intent` reaches a terminal state.
- [ ] Bookings: no `pending_payment` older than the hold window (confirms cron runs).
- [ ] `payout_transfers`: no `failed` piling up.
- [ ] Manually watch for auth/booking failures (not yet logged server-side).

---

## 8. Final Verdict

**What is production-ready (verified):**
- Messaging end-to-end + auto-conversation creation (Phase 12.1 ✅).
- Security: RLS, authz, secrets, redirects, input validation, privilege-escalation (✅ live-verified).
- Background-job routines (✅ run live); booking/payment engine; admin analytics (real data); role-gated admin access.
- DB migrations `0011`–`0014` applied + verified.

**What still blocks CONTROLLED BETA (4 items):**
1. Valid Stripe key (payments non-functional today).
2. Real provider supply (no self-serve onboarding — onboard first pros manually).
3. Remove/flag demo providers.
4. Confirm `pg_cron`.
→ All are operator/short-build items. **After these: READY FOR CONTROLLED BETA.**

**What still blocks PUBLIC LAUNCH (beyond the beta items):**
- Self-serve provider onboarding (profile creation + portfolio upload wiring + role assignment).
- Admin trust-&-safety UI (wire the built resolve/verify/freeze actions; add bookings/payouts views + search).
- Real error monitoring (Sentry DSN) + distributed rate limiting on messaging/booking.
- Partial-deposit payout math fix + one live end-to-end payout.
- Cross-browser QA on real iOS Safari/Firefox; LCP optimization (~4.0s → <2.5s).

**Controlled beta readiness:** 🟠 **NOT YET — 4 operator items away** (Stripe key, provider supply, demo data, pg_cron).
**Public launch readiness:** 🔴 **NOT READY** — needs the self-serve/admin/observability/payout work above.

*Nothing in this report is marked verified unless it was tested against production (✅) or read directly in code (🧾). Items I could not reach — the Stripe dashboard, the `cron` schema, and production secret values — are explicitly marked ⛔/🔑/🖥️ and handed to the operator.*
