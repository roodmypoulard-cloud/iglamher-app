# iGlamHer — Production Audit

**Date:** 2026-07-19 · **Target:** https://iglamher-app.vercel.app (Next.js 16 App Router · TypeScript · Supabase · Stripe)

This folder contains a full production audit. Automated reports (1–4) were generated with Lighthouse and the production build; reports 5–15 were produced by tracing the actual source (migrations, server actions, Stripe webhook, RLS policies).

## Contents

| # | Report | Headline |
|---|---|---|
| 01 | [Lighthouse](./01-lighthouse-report.md) | Perf **72** · A11y **100** · Best Practices **96** · SEO **100** |
| 02 | [Performance](./02-performance-report.md) | Only gap: LCP 5.7 s (hero image). TBT 20 ms, CLS 0 |
| 03 | [Accessibility](./03-accessibility-report.md) | Perfect 100, strong practices |
| 04 | [Bundle size](./04-bundle-size-analysis.md) | ~450–550 KB compressed shared JS, well split |
| 05 | [Route analysis](./05-route-analysis.md) | 44 routes; access model documented |
| 06 | [Component tree](./06-component-tree.md) | 32 client / 21 server components |
| 07 | [Features](./07-features.md) | Implemented-features inventory (live vs mock) |
| 08 | [TODOs / unfinished](./08-todos.md) | Incomplete areas |
| 09 | [Database schema](./09-database-schema.md) | Tables, enums, RLS, functions (migrations 0001–0010) |
| 10 | [API routes + server actions](./10-api-routes.md) | REST handlers + the real server-action surface |
| 11 | [Auth flow](./11-auth-flow.md) | Supabase auth, roles, callback, safe redirects |
| 12 | [Booking flow](./12-booking-flow.md) | Availability engine + atomic `create_booking` |
| 13 | [Payment flow](./13-payment-flow.md) | Stripe Checkout, webhook source-of-truth, Connect |
| 14 | [Known bugs](./14-known-bugs.md) | Confirmed + suspected correctness issues |
| 15 | [Security issues](./15-security-issues.md) | Evidence-based, ranked by severity |

Raw artifacts: `lighthouse.report.html`, `lighthouse.report.json`, `04-bundle-and-routes.txt`, `08-todos-raw.txt`.

---

## Executive summary

**The foundation is genuinely solid and safe to run in production for the current (test-mode) money loop.** There is **no critical auth/secret vulnerability.** The strengths:

- **RLS is deny-by-default** and hardened at the column level (`0005_column_guards.sql` blocks self-verify, self-feature, price-zeroing, review-forging).
- **Stripe webhook is signature-verified, deduped, and idempotent** (`stripe_events`); **all money is computed server-side** — the client never sets amounts.
- **Bookings can't double-book** — `create_booking` is an atomic RPC with a GiST exclusion constraint.
- **Secrets are correctly partitioned** — service-role key is `server-only`; nothing sensitive is in `NEXT_PUBLIC_*`.
- **Accessibility 100 / SEO 100 / Best-Practices 96.**

The gaps are concentrated in **the growth features and the payout side of payments** — mostly things that are latent today (unwired UI, tax always 0, test mode) but must be fixed before scaling real money and the loyalty/referral programs.

## Prioritized fix list (before scaling)

### 🔴 High — fix before enabling loyalty/referral with real value
1. **Loyalty redemption is a non-atomic read-check-write** on the service-role client → concurrent calls double-spend credit (`lib/loyalty/actions.ts:26-33`). Fix: do the debit in a single atomic SQL statement / RPC with a balance guard. See [15](./15-security-issues.md).
2. **Referral welcome credit is Sybil-farmable** — the fraud engine's device/IP/velocity signals are never passed by the caller, so only self-referral is blocked (`lib/referral/actions.ts:29`). Fix: pass real signals (or gate credit behind first completed booking). See [15](./15-security-issues.md).

### 🟠 Medium
3. **Rate limiting is written but not wired** — `redisRateLimit` (`lib/cache/redis.ts:79`) is never imported; only auth is limited, via per-instance in-memory. Wire Redis-backed limiting to messaging/booking/loyalty/referral before scale. See [15](./15-security-issues.md).
4. **Performance / LCP** — convert the hero from a plain `<img>` to `next/image` with `priority`. Single highest-leverage perf change; should move Performance into the low 90s. See [02](./02-performance-report.md).
5. **`charge.refunded` hardcodes `fullyRefunded = true`** (`api/stripe/webhook/route.ts:124`) → partial refunds mark payments fully refunded. See [14](./14-known-bugs.md).

### 🟡 Payments — required before real payouts
6. **No Connect split at charge time** — funds land on the platform account; the **payout Stripe transfer is a TODO** and `createBookingPaymentIntent` is dead code. Wire destination charges or transfers before paying pros. See [13](./13-payment-flow.md).
7. **Pro earnings/payout math uses `total − platform_fee`** (includes tax) instead of `pricing.ts` net — latent only because tax is currently always 0. See [14](./14-known-bugs.md).

### 🟢 Low / product completeness
8. **Onboarding forms are stubs** (`completeCustomerOnboarding` doesn't exist); `/bookings` and `/messages` are static placeholders; the `(marketing)` route group is empty. See [07](./07-features.md), [08](./08-todos.md).
9. **`updateBookingStatusAction` uses the user-scoped client** and would be blocked by the `0005` trigger from setting `in_progress`/`completed` — latent because the action isn't UI-wired yet. Use the admin client or adjust the policy when wiring it. See [14](./14-known-bugs.md).
10. Min-notice / booking-window / platform take-rate are hardcoded — move to `platform_settings` if they need to be tunable. See [12](./12-booking-flow.md).

## Verdict

Ship-ready for the current test-mode marketplace and the core booking→payment→confirmation loop. Before (a) switching Stripe to live payouts and (b) turning on loyalty/referral with real monetary value, close the High items (1–2), the payout wiring (6), and the partial-refund bug (5). Everything else is polish or latent.
