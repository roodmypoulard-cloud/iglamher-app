# Phase-12 — Production Security & Observability Verification

**Target:** `/Users/roodmypoulard/iglamher-app` (Next.js 16 + Supabase + Stripe)
**Mode:** READ-ONLY, evidence-based (`file:line`)
**Date:** 2026-07-20
**Verdict:** Strong security posture. No Critical/High issues found in code. The real gaps are observability (no external error sink, thin server-side logging) and defense-in-depth (rate limiting scoped to auth only; internal error strings surfaced to clients).

---

## SECURITY

### 1. No secrets committed / hardcoded — **PASS**
- Regex sweep for `sk_live|sk_test|pk_live|whsec_|eyJ…|AKIA|-----BEGIN` over `src/` returned **zero** hits.
- `git ls-files | grep .env` → no `.env` files tracked. `.gitignore:34` ignores `.env*`, allowlists only `.env.example`.
- All keys resolve from `process.env` via the validated schema in `src/lib/env.ts`.

### 2. No private env reaches the browser — **PASS**
- Every `NEXT_PUBLIC_*` reference is a public value (app URL, Supabase URL, anon key, Stripe *publishable* key) — see `src/lib/env.ts:7-9,47-53`.
- `SUPABASE_SERVICE_ROLE_KEY` is used only in `src/lib/supabase/admin.ts:11`, which opens with `import "server-only"` (`admin.ts:1`) — a client-bundle import throws at build time.
- `STRIPE_SECRET_KEY` is used only in `src/lib/payments/stripe.ts:9,22` (`import "server-only"` at `stripe.ts:1`).
- `STRIPE_WEBHOOK_SECRET` is used only in `src/app/api/stripe/webhook/route.ts:24,34` (server route).
- 28 modules across `src/lib/**` carry `import "server-only"` guarding every privileged surface (payments, admin, storage, audit, integrations).

### 3. AuthN + AuthZ enforced server-side on every mutating action/route — **PASS**
Spot-checked all 17 `*actions.ts` files. Every mutation calls `supabase.auth.getUser()` server-side and then applies an ownership or role check. `auth/actions.ts` is the only file with no `getUser` — correct, it *is* sign-in/sign-up. Evidence:
- **Ownership-scoped (user's own client → RLS):** `booking/actions.ts:123-129` (party check on customer/professional), `messaging/actions.ts:24-52` (sender = self, membership via RLS), `favorites-actions.ts:37-46`, `moderation/actions.ts:39-52`, `push-actions.ts:23-45`, `pro/actions.ts` (every write ends `.eq("professional_id", gate.userId)` — `:69,88,159,171`).
- **Payment ownership:** `payments/actions.ts:20-33` — reads booking from DB, rejects if `customer_id !== auth.user.id` and if status ≠ `pending_payment`.
- **Payout authZ:** `payout-actions.ts:29-37` — owning professional **or** admin only.
- **Role-gated admin:** `admin/actions.ts:14-22`, `admin/trust-actions.ts:13-20`, `marketing/actions.ts:13-20`, `ops/actions.ts:18-21` — all `requireAdmin()` (role must equal `admin`) before any service-role write.
- **Role-gated pro:** `connect-actions.ts:12-19`, `pro/actions.ts:17-22` — role must be `professional`/`admin`.
- Privilege-escalation guard: `pro/actions.ts:140-141` explicitly excludes `is_active`/`is_verified` from self-editable fields ("a pro cannot activate or verify themselves").
- Loyalty/referral use the service-role client but key writes on `auth.user.id` (`loyalty/actions.ts:31`, `referral/actions.ts:57,65,87`) — no cross-user write.

### 4. RLS protects all user-owned tables — **PASS**
- `supabase/migrations/0003_rls.sql` enables RLS on **all 28** tables and defines ownership/party/role policies. `admin_roles` + `audit_logs` have RLS on with **no** client policy = deny-by-default (`0003_rls.sql:29-30`).
- Sensitive tables gated to booking parties + admin: `payments`, `refunds`, `payout_records` (`0003_rls.sql` PAYMENTS block).
- **Known 42P17 recursion bug — confirmed present in original, fixed in 0013.** The original `"convo membership read"` policy (`0003_rls.sql`, MESSAGING block) references `conversation_members m2` inside its own `USING` clause on `conversation_members` → infinite recursion, which cascaded to the `conversations` and `messages` policies. `0013_fix_messaging_rls.sql` drops it and replaces with the non-recursive `user_id = auth.uid()`. Correct fix. **Confirm 0013 is applied to production** (it is the newest migration, dated today).

### 5. Webhook signature verification + idempotency — **PASS**
`src/app/api/stripe/webhook/route.ts`: signature verified via `stripe.webhooks.constructEvent(...)` (`:34`, 400 on failure `:36`); missing-signature 400 (`:29`); exactly-once via unique insert into `stripe_events` with `23505` → duplicate ack (`:43-48`); dedup marker rolled back on genuine failure so Stripe retries (`:55-59`); side effects are status-guarded upserts (`:76-80`). Refund path correctly distinguishes partial vs full (`:143-149`).

### 6. File-upload validation — **PASS**
- Avatars (`account/avatar-actions.ts`): MIME allowlist `jpeg/png/webp` (`:13,38-40`), 5 MB cap (`:14,41`), server-generated path `${user.id}/avatar-${crypto.randomUUID()}.${ext}` (`:53`) — filename never taken from user input.
- Verification docs (`storage/documents.ts`): `validateDocument()` MIME allowlist + 15 MB cap (`:24-30`), private bucket, admin-only signed URLs (5-min TTL) with role check (`:71-74`), every view audit-logged (`:80`). Filename passed through `safeFilename(file.name)` (`:47`) and prefixed with `user.id` + UUID.

### 7. Redirect restriction (open-redirect) — **PASS**
`src/lib/auth/safe-next.ts`: rejects non-`/` values, `//` protocol-relative, backslashes, scheme (`^\/+[a-z…]*:`), and control chars (incl. encoded CR/LF header smuggling). Falls back to `/discover`. Thorough — covers the `//evil.com` and `/\evil.com` bypasses in its own comments.

### 8. Payment/payout amounts cannot be altered client-side — **PASS**
- Checkout amount read from persisted booking (`payments/actions.ts:24-31`), never from client input.
- Payout split computed server-side: `payoutAmountCents(total, platformFee)` (`payments/split.ts:7-9`), called in webhook (`route.ts`) and `payout-actions.ts`. Application fee + destination set server-side in `stripe.ts:createBookingPaymentIntent`.

### 9. Admin routes protected — **PASS**
- `src/app/admin/{page,campaigns/page,analytics/page}.tsx` all call `requireAdminPage(...)` (`require-admin-page.ts:10-16`): redirects unauthenticated → `/signin`, non-admin → `/discover`.
- Pro dashboard pages gate on `getProContext()` (`pro/context.ts`), which returns `authed:false` when live DB + no user.
- Note: page gates are the UX layer; the authoritative enforcement is the per-action `requireAdmin()`/`requirePro()` + RLS (verified in §3).

### 10. Error messages / log hygiene — **NEEDS-MANUAL (see Medium/Low issues)**
- Health endpoint never leaks secrets (`api/health/route.ts` returns only booleans + config keys).
- **But:** raw DB/storage `error.message` is returned to the client in **31 call sites** across `src/lib/**` (e.g. `avatar-actions.ts:59,72`, `admin/actions.ts`, `pro/actions.ts`). Postgres/Storage internal strings should not reach the browser — see **M2**.
- `notifications.ts:51` logs `to: p.email` (PII in logs) — see **L1**.

### 11. Rate limiting — **PARTIAL (known gap confirmed) — Medium**
- `redisRateLimit` is fully implemented in `src/lib/cache/redis.ts:83-108` (distributed sliding window, fails open + logs) but **is never called anywhere** — grep for `redisRateLimit` outside `redis.ts` returns nothing.
- The active limiter is the **in-memory** `rateLimit()` (`security/rate-limit.ts`), wired to exactly 3 places: `auth/actions.ts:20,44` (sign-in/up) and read-only routes `api/recommendations/route.ts:13` + `api/search/suggest/route.ts:13`.
- **Mutating actions have no rate limiting:** booking creation, checkout, messaging, reviews, favorites, referral redemption, payout retry. And the in-memory limiter is per-instance — it resets on every serverless cold start and doesn't coordinate across regions. See **M1**.

---

## OBSERVABILITY

| Capability | Status | Evidence |
|---|---|---|
| Error tracking (external sink) | **Console-only** | `observability/logger.ts:22-30` — `captureError` emits JSON to `console.error`; the Sentry forward is a **commented stub** (`:29`). `SENTRY_DSN` is documented (`env.ts:59`) and listed as an integration (`integrations/config.ts:42`) but never imported/called. **M3** |
| Structured logging | **PASS** | `logger.ts` — single-line JSON `{level,message,ts,...fields}`, drain-friendly. `timed()` helper for latency. |
| Webhook logging | **PASS** | `webhook/route.ts` — `log.info` on success/payout (`:106,113`), `captureError` on dedup + handler failure (`:47,57`). |
| Failed-booking / payout logging | **Partial** | Payout status logged in webhook (`route.ts:106`). But `booking/actions.ts` and `payments/actions.ts` have **0** `log.*`/`captureError` calls — booking failures return to UI without server capture. **M4** |
| Server error logging (general) | **Thin** | Only `redis.ts`, `logger.ts`, and the webhook use `log.error`/`captureError`. The 17 action files log nothing; they return `{ok:false,error}` to the client instead. **M4** |
| Auth-error logging | **Missing** | `auth/actions.ts` returns errors to UI, never logs failed sign-ins / lockouts — no security-event trail. **M4** |
| DB-error logging | **Missing** | DB errors are surfaced to the client (`error.message`) but not logged server-side (see §10 / **M2**). |
| Health-check endpoint | **PASS** | `api/health/route.ts` — liveness + readiness (db/payments/integrations), `no-store`, 200/503, no secrets. |
| Log hygiene | **Mostly PASS** | No tokens/passwords/card data logged. One PII leak: email in `notifications.ts:51`. **L1** |

---

## Ranked Issues

### Critical — none.
### High — none.

### Medium
- **M1 — Rate limiting doesn't cover mutations and isn't distributed.** The distributed `redisRateLimit` is dead code; the active in-memory limiter guards only auth + 2 read routes and resets per serverless instance. Booking/checkout/messaging/referral mutations are unthrottled → abuse/enumeration/spam risk. *Fix: wire `redisRateLimit` into `rateLimitGuard` when Redis is configured, and add guards to mutating actions.* (`cache/redis.ts:83`, `security/guard.ts`, `security/rate-limit.ts`)
- **M2 — Internal error strings leak to clients.** 31 sites return raw `error.message` (Postgres/Storage internals) to the browser. Low-value to an attacker but violates "no internals in error messages." *Fix: return a generic message to the user; `captureError` the raw one server-side.*
- **M3 — No external error sink.** `captureError` is console-only; Sentry forwarding is a commented stub despite `SENTRY_DSN` being wired through config. In production a crash is only visible in raw platform logs — no alerting/aggregation. *Fix: implement the forward in `logger.ts:29`.*
- **M4 — Thin server-side error/auth/DB logging.** Server actions swallow failures into UI responses without capture; failed auth attempts and DB errors leave no server trail. Combined with M3, incident forensics are weak. *Fix: `captureError` in action catch/error branches; log auth failures.*

### Low
- **L1 — PII (email) in logs.** `notifications.ts:51` logs recipient email. *Fix: log `userId` only (as the push path already does at `:77`).*
- **L2 — Fail-open degradations are correct but reduce protection silently at scale.** `redisRateLimit` and `RedisCache` fail open on Redis outage (logged as "REDUCED protection", `redis.ts:75,105`). Acceptable trade-off; ensure the degradation log is alerted on.

---

## Good Practices Observed
- Consistent **`import "server-only"`** discipline (28 modules) — structurally prevents secret/service-role leakage to the client bundle.
- **Defense in depth:** every mutation is guarded *both* by an explicit server-side `getUser` + ownership/role check *and* by RLS policies (`0003_rls.sql`), with deny-by-default on admin/audit tables.
- **Server-authoritative money:** amounts and payout splits are always computed from persisted data, never client input; pure, unit-testable split math (`split.ts`).
- **Webhook is textbook:** signature-verified, exactly-once via unique event id, idempotent status-guarded upserts, retry-safe rollback, correct partial-vs-full refund handling.
- **Self-escalation explicitly blocked** (`pro/actions.ts:140`) — pros can't set their own `is_verified`/`is_active`.
- **Verification docs** in a private bucket, admin-only short-lived signed URLs, every access audit-logged.
- **Hardened open-redirect guard** covering protocol-relative, backslash, scheme, and CRLF-smuggling vectors.
- **Validated env schema** (`env.ts`) with staging/prod assertions (HTTPS app URL, non-placeholder values).
- Real **health endpoint** and **structured JSON logging** primitives already in place — the observability foundation exists; it's under-wired, not absent.
