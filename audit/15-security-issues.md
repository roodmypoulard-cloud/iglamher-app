# iGlamHer — Security Review

**Scope:** Next.js 16 + Supabase (RLS) + Stripe marketplace handling real payments.
**Method:** Static review of the actual source (server actions, API routes, SQL migrations, storage policies, middleware, config). Every finding cites `file:line` and the code path that proves it.
**Date:** 2026-07-19
**Reviewer:** Senior security engineer (audit)

## Executive summary

This codebase is **unusually security-aware for its stage**. Authorization is enforced in depth: RLS is deny-by-default, and a dedicated migration (`0005_column_guards.sql`) closes the column-level gaps that plain row-level RLS leaves open (self-verify, self-feature, zero-out prices, forge review scores). The Stripe webhook is signature-verified, deduplicated, and idempotent, and all money is computed server-side from persisted data. Secrets are correctly partitioned (`server-only`, no secret in `NEXT_PUBLIC_*`).

The remaining issues are mostly **financial-integrity races and abuse vectors in the loyalty/referral growth features**, plus **rate-limiting that is implemented but not actually wired into production**. No Critical authz/secret-exposure bug was found. I did not invent issues to pad the list.

| # | Severity | Title |
|---|----------|-------|
| H1 | High | Loyalty redemption is a non-atomic read-check-write → credit double-spend |
| H2 | High | Referral welcome-credit farmable; fraud engine's signals are never supplied |
| M1 | Medium | Production rate limiting is in-memory per-instance; the distributed limiter is never wired |
| M2 | Medium | Rate limiting absent on messaging / booking / loyalty / referral mutations |
| M3 | Medium | CSP allows `'unsafe-inline'` in `script-src` |
| L1 | Low | Edge functions rely on default JWT verification (unconfirmed) |
| L2 | Low | `awardBookingPoints` check-then-insert race |
| I1 | Info | `take_rate_bps` per-pro is ignored; all bookings hardcode 15% |

---

## H1 — Loyalty redemption double-spend (race condition, financial)

**Evidence:** `src/lib/loyalty/actions.ts:26-33`

```ts
const { data: acct } = await admin.from("loyalty_accounts").select("points,...").eq("user_id", auth.user.id).maybeSingle();
const points = (acct as {...}).points ?? 0;
if (!canRedeem(points, parsed.data.discountCents)) return { ok: false, error: "Not enough points." };
const cost = pointsForRedemption(parsed.data.discountCents);
await admin.from("loyalty_accounts").update({ points: points - cost, ... }).eq("user_id", auth.user.id);
await admin.from("account_credits").insert({ user_id: auth.user.id, amount_cents: parsed.data.discountCents, reason: "loyalty_redemption" });
```

This runs on the **service-role** client and does a read → in-app check → unconditional write. There is no `where points >= cost` guard and no transaction/lock.

**Impact:** A user with balance N fires two `redeemPointsAction` calls concurrently. Both read `points = N`, both pass `canRedeem`, both insert an `account_credits` row, and the final `points` write is a last-writer-wins clobber (ends at `N - cost`, not `N - 2*cost`). Result: **real account credit granted for points never held** (points can even go negative). Directly monetizable.

**Fix:** Make the debit atomic and conditional. Either a Postgres RPC `redeem_points(uid, cost)` that does `UPDATE loyalty_accounts SET points = points - cost WHERE user_id = uid AND points >= cost RETURNING points;` and only writes the credit if a row was updated, or an optimistic-concurrency guard (`.eq("points", points)` on the update and retry/abort if 0 rows changed). The credit insert and the debit must be in one transaction.

---

## H2 — Referral welcome credit is farmable; fraud signals are dead

**Evidence:** `src/lib/referral/actions.ts:29,42-45` and `src/lib/referral/engine.ts:59-68`

```ts
// actions.ts
const fraud = checkReferralFraud({ referrerId: referrer.user_id, referredId: auth.user.id });
if (!fraud.ok) return { ok: false, error: fraud.reasons[0] };
...
if (reward.referredCreditCents > 0) {
  await admin.from("account_credits").insert({ user_id: auth.user.id, amount_cents: reward.referredCreditCents, reason: "referral_welcome" });
}
```

```ts
// engine.ts — checks depend on fields the caller never passes
export function checkReferralFraud(input: FraudCheckInput): FraudResult {
  if (input.referrerId === input.referredId) reasons.push("Self-referral");
  if (input.sameDevice) reasons.push("Same device as referrer");
  if (input.sameIp && input.referredAccountAgeHours != null && input.referredAccountAgeHours < 1) {...}
  if ((input.referrerReferralsLast24h ?? 0) > 20) reasons.push("Referral velocity too high");
  ...
}
```

The action passes **only** `referrerId` and `referredId`. `sameDevice`, `sameIp`, `referredAccountAgeHours`, and `referrerReferralsLast24h` are all `undefined`, so every branch except self-referral is inert. The welcome credit ($15 for `customer` codes, `REWARD_CONFIG` engine.ts:20) is granted **immediately on applying a code**, with the only real gate being one-referral-per-referred-user.

**Impact:** Sybil abuse. Register account → apply any valid code → collect $15 credit. Repeat with throwaway accounts. There is no requirement that the referred user is genuinely new (no account-age check, no "must complete first booking" gate before the welcome credit is issued). The anti-fraud engine exists but is bypassed because its inputs are never wired.

**Fix:** Supply the real signals at the call site (client IP from `clientIp()`, device fingerprint, `auth.user.created_at` → age hours, and a `count(*)` of the referrer's last-24h referrals) and enforce them. Gate the referred user's credit on eligibility (email-verified + no prior bookings), and consider deferring the welcome credit until the first paid booking, matching the referrer payout model.

---

## M1 — Production rate limiting is per-instance in-memory; the serverless-safe limiter is never used

**Evidence:** `src/lib/security/rate-limit.ts:25-48,82-89` (default `MemoryStore`), `src/lib/security/guard.ts:17-24`, vs. `src/lib/cache/redis.ts:79-96` (`redisRateLimit`, implemented, sorted-set based). Grep confirms `redisRateLimit` is **not imported anywhere** outside its own file, and `rateLimitGuard`/`rateLimit()` always use the in-memory registry.

**Impact:** On Vercel/serverless, each function instance has its own `Map`. Auth throttling (`LIMITS.auth = 5/min`, the only place `rateLimitGuard` is called — `src/lib/auth/actions.ts:20,44`) is trivially defeated by fan-out across instances, and cold starts reset counters. Credential-stuffing / enumeration protection is far weaker than the config implies. The env comment (`REDIS_URL … distributed rate limiting`, `src/lib/env.ts`) advertises protection the running code does not deliver.

**Fix:** Route the guard through `redisRateLimit` when `isRedisConfigured()`, falling back to memory only in dev. The distributed implementation already exists — wire it into `guard.ts` and the two API routes.

---

## M2 — Rate limiting missing on sensitive mutating surfaces

**Evidence:** `rateLimitGuard` appears only in `src/lib/auth/actions.ts`. It is **absent** from:
- `src/lib/messaging/actions.ts:17` `sendMessageAction` (despite `LIMITS.message = 30/min` being defined, `rate-limit.ts:75`)
- `src/lib/booking/actions.ts:28` `createBookingDraftAction` (despite `LIMITS.booking`)
- `src/lib/loyalty/actions.ts:16` `redeemPointsAction`, `src/lib/referral/actions.ts:15` `applyReferralCodeAction`, `src/lib/moderation/actions.ts:17` `reportContentAction`.

**Impact:** Messaging spam, booking-slot probing, and rapid-fire attempts at the H1/H2 abuse paths are unthrottled. The `message`/`booking` limiters are defined but never invoked.

**Fix:** Add `await rateLimitGuard("message" | "booking" | ...)` at the top of each mutating action, keyed by user id where available (IP for anonymous).

---

## M3 — CSP permits `'unsafe-inline'` scripts

**Evidence:** `next.config.ts:13` — `"script-src 'self' 'unsafe-inline' https://js.stripe.com"`.

**Impact:** `'unsafe-inline'` in `script-src` neutralizes CSP's core XSS mitigation: any injected inline `<script>` executes. The rest of the policy is strong (`object-src 'none'`, `frame-ancestors 'none'`, `base-uri 'self'`, tight `connect-src`), so this is the weakest link.

**Fix:** Move to a nonce/hash-based `script-src` (Next 16 supports per-request nonces via middleware). `style-src 'unsafe-inline'` is a lesser concern but ideally also hashed.

---

## L1 — Edge functions: confirm JWT verification is enabled

**Evidence:** `supabase/functions/payout-processor/index.ts:8` and `supabase/functions/booking-reminders/index.ts` are `Deno.serve` handlers with **no in-handler auth check**; they run with the service role. `payout-processor` creates `payout_records` for all completed bookings.

**Impact:** If deployed with `--no-verify-jwt`, the payout trigger and reminder blaster become publicly invokable (idempotency limits payout damage since transfers are still a `TODO`, but reminders could be spammed and the endpoint DoS'd). Supabase verifies JWTs by default, so this is **needs-verification**, not confirmed.

**Fix:** Ensure both functions are deployed with JWT verification on and invoked only via cron with a service-role bearer; add a shared-secret header check as defense-in-depth.

---

## L2 — `awardBookingPoints` check-then-insert race

**Evidence:** `src/lib/loyalty/award.ts:13-31` — selects an existing `earn_booking` transaction, then reads/updates the balance and inserts. No unique constraint enforcement visible in-app.

**Impact:** Low (completion is normally single-path), but concurrent completion events could double-award or lose the balance update. See also bug B5 in `14-known-bugs.md`.

**Fix:** Rely on a DB unique constraint `(booking_id, reason)` and an atomic increment; treat the unique-violation as "already awarded."

---

## I1 — Per-professional take rate is ignored

**Evidence:** `src/lib/booking/actions.ts:53` — `takeRateBps: 1500, // professional.take_rate; default 15%` is hardcoded, while `0005_column_guards.sql:27-38` treats `take_rate_bps` as an admin-managed per-pro column. Not a vulnerability, but the platform's own revenue model is not applied per pro. Flagged for correctness (see bug I in `14-known-bugs.md`).

---

## Good practices observed (balance)

These are genuinely well done and worth preserving:

1. **Service-role isolation.** `src/lib/supabase/admin.ts:1` uses `import "server-only"` so the key cannot reach a client bundle; `src/lib/env.ts` keeps `SUPABASE_SERVICE_ROLE_KEY` out of the `NEXT_PUBLIC_*` schema; `.env*` is gitignored except the template (`.gitignore`).
2. **Deny-by-default RLS.** `0003_rls.sql:31-32` enables RLS on `admin_roles`/`audit_logs` with **no** client policy → unreachable via anon key. Sensitive tables (payments, refunds, payouts) are party-scoped (`0003_rls.sql:106-116`).
3. **Column-level guards** (`0005_column_guards.sql`) close the gap RLS leaves: pros can't self-`is_active`/`is_verified`/`is_featured` or zero `take_rate_bps` (:27-47); parties can't mutate snapshotted pricing or force settlement statuses (:55-92); neither party can forge review `rating`/`is_published` (:101-137). Also tightens `avail_*` and `promo_codes` reads (:140-169).
4. **Role-escalation trigger** (`0002_functions.sql:52-70`) — only service-role/admin can set admin/support; customers may self-upgrade to `professional` only.
5. **Stripe webhook is the source of truth** (`src/app/api/stripe/webhook/route.ts`): signature-verified (:34), exactly-once via `stripe_events` insert + `23505` dedup (:44-52), idempotent upserts keyed on payment intent, status-guarded booking confirmation (`.eq("status","pending_payment")`, :76), and correct retry semantics (500 only on genuine failure, rollback of the dedup marker on handler error).
6. **Server-authoritative money.** Checkout amount is read from the persisted booking with an ownership + status check (`src/lib/payments/actions.ts:22-33`); booking price is recomputed server-side and never trusted from the client (`src/lib/booking/actions.ts:37-55`); `create_booking` is `SECURITY DEFINER` with an `auth.uid()` ownership check and an exclusion constraint against double-booking (`0005_booking_engine.sql:126-147`).
7. **Open-redirect hardening** with tests: `src/lib/auth/safe-next.ts` rejects `//host`, backslashes, schemes, and control/CRLF chars; used in the callback and sign-in (`auth/callback/route.ts:15`, `auth/actions.ts:57`). Test file present.
8. **Storage.** Verification docs live in a **private** bucket, read only via short-lived admin-minted signed URLs with audit logging (`src/lib/storage/documents.ts:54-67`), owner-prefixed paths, and `safeFilename` sanitization (`src/lib/pro/schemas.ts:63`). Avatars use a UUID filename under the user's id prefix; the DB write goes through the user client so RLS enforces self-ownership (`src/lib/account/avatar-actions.ts:52,62-65`). Storage policies scope writes to `(storage.foldername(name))[1] = auth.uid()` (`storage-policies.sql`).
9. **Review integrity** enforced in DB: `enforce_review_eligibility` requires a completed booking owned by the reviewer (`0002_functions.sql:91-102`).
10. **Contact-info guard** enforced server-side before payment unlock, blocked attempts logged redacted (`src/lib/messaging/actions.ts:36-48`, `contact-guard.ts`).
11. **Security headers**: HSTS (HTTPS only), `X-Frame-Options: DENY`, `nosniff`, `Referrer-Policy`, tight `Permissions-Policy`, `poweredByHeader:false`, and a Stripe-scoped `connect-src`/`frame-src` (`next.config.ts:11-49`).
12. **Consistent authz pattern**: every admin action re-checks `profiles.role === 'admin'` via the user session before using the service-role client (`admin/actions.ts:13-21`, `ops/actions.ts:18-21`, `marketing/actions.ts`); pages gate with `requireAdminPage` (`admin/*` verified). Pro actions require `professional`/`admin` role (`pro/actions.ts:17-21`).
13. **Input validation** with Zod on effectively every action boundary (`booking/actions.ts:14`, `messaging/actions.ts:10`, `pro/schemas.ts`, `auth/schemas.ts`, `moderation/actions.ts:10`), including bounded array/string lengths.

**Bottom line:** the authorization and payments core is solid and defense-in-depth. Prioritize H1/H2 (money can leak through the growth features) and M1/M2 (turn on the rate limiting that's already written), then M3.
