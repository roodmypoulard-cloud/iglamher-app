# Phase 11 — Marketplace Completion & Revenue Activation

**Date:** 2026-07-19 · Builds on Phase 10. Honest status against your own bar:
**"do not mark features complete unless fully connected UI→backend and verified with tests."**

Phase 11 as specified is several multi-week builds (live payouts, full real-time messaging, complete onboarding, full booking lifecycle UI, reputation display, provider analytics, perf-to-95). This turn delivered the **single launch-critical, revenue-blocking system — Stripe Connect payouts — end-to-end at the backend, tested**, plus a tested reputation engine. The rest is scoped honestly below.

---

## Completion %

| Track | Status | Completion |
|---|---|---|
| **1. Stripe Connect payouts** | Backend complete + tested; needs live keys + connected pro to verify E2E | **~85%** |
| 5. Ratings & reputation | Verified-only reviews + ratings already live; **badge/metrics engine added + tested**, display not wired | ~55% |
| 4. Booking lifecycle | Create/availability/cancel-policy live; reschedule/accept/reject/complete UI not built | ~40% |
| 3. Professional onboarding | Service/availability/Connect editing live; completion % + search-gating not built | ~45% |
| 2. Real-time messaging | Placeholder — not started | ~5% |
| 6. Provider analytics dashboard | Earnings page exists; analytics (views, conversion, trends) not built | ~30% |
| 7. Customer-experience polish | Skeletons/empty/error states exist in many places; not audited exhaustively | ~70% |
| 8. Performance 95+ | 84 after Phase 10 hero fix; not yet 95 | — |
| **Overall (private beta / test mode)** | | **~90%** |
| **Overall (public launch / live money)** | | **~78%** |

---

## What shipped this phase (verified with tests)

### 1. Stripe Connect payouts — the revenue blocker, now wired
Separate charges + transfers architecture (charge → platform keeps commission → transfer net to the pro's connected account):

- **`payout_transfers` table** (migration `0012_payout_transfers.sql`) — one row per booking, status `pending|paid|failed|reversed`, failure reason, RLS (pro/admin read only).
- **`lib/payments/payouts.ts`** — `transferBookingPayout()`: idempotent per booking (`payout_transfers.unique(booking_id)` + Stripe `idempotencyKey: payout_<id>`), gated on real Connect eligibility (`connect_payouts_enabled && !payouts_frozen`), **best-effort inside the webhook** (records `failed`/`pending`, never blocks confirmation). `reverseBookingPayout()`: proportional transfer reversal on refund (**refund compatibility**).
- **`lib/payments/split.ts`** — pure `payoutAmountCents(total, fee)` (net = total − commission; tax/tip excluded from the platform base). **Unit-tested.**
- **Webhook wiring** (`api/stripe/webhook/route.ts`) — `payment_intent.succeeded` now creates the transfer after recording the earning; `charge.refunded` reverses it. Everything **webhook-driven, no manual payout logic.**
- **Failed-payout recovery** (`lib/payments/payout-actions.ts`) — `retryBookingPayoutAction()` re-attempts failed/pending payouts (e.g. after the pro finishes onboarding); authorized to the owning pro or an admin.

**Money flow verified in code:** Customer payment → platform (commission retained) → transfer of net → professional's connected account; refunds reverse proportionally.

### 5. Reputation engine (foundation)
- **`lib/reputation/badges.ts`** — `reputationMetrics()` (completion / cancellation / response / repeat rates, divide-by-zero safe) and `reputationBadges()` → `verified` / `top_pro` / `new_provider` with documented thresholds. **Unit-tested (6 cases).** Not yet wired to the profile/search UI.

**Tests:** 160 passing (was 149 pre-Phase-10). Typecheck clean, ESLint clean, build clean, deployed.

---

## Remaining blockers

### 🔴 Public-launch blockers (live money)
1. **Apply migrations `0011` + `0012` to the live DB** and switch Stripe to **live keys with Connect enabled.** The payout code is complete but runs against test mode; it must be exercised with a real connected account.
2. **End-to-end live payout verification** — one real booking → charge → transfer → pro receives funds → refund → reversal. Cannot be self-verified without live Stripe + a connected test pro.
3. **Real-time messaging** (item 2) is still a placeholder — a public marketplace needs customer↔pro comms. Substantial build (Supabase Realtime, read receipts, image sharing, contact-info redaction).

### 🟠 Complete-product gaps (not blockers for a limited private beta)
4. **Booking lifecycle UI** — reschedule/cancel (customer), accept/reject/complete/no-show (pro), admin overrides. Backend note: wire `updateBookingStatusAction` via the admin client (the `0005` guard blocks user-scoped status writes).
5. **Onboarding completion % + "hidden from search until 100%"** gating.
6. **Provider analytics dashboard** (views, search appearances, conversion, rating trends).
7. **Reputation display** — surface the new badges/metrics on profiles and in search.
8. **Performance to 95** — smaller hero source + preload; wire Redis rate-limiting.

---

## Readiness

- **Beta readiness (Stripe test mode): READY** once `0011`/`0012` are applied. Core loop (discover → book → pay → confirm → review) works and is safe; payouts run in test mode.
- **Public-launch readiness (real money): NOT READY** — needs live Stripe/Connect keys, the E2E payout verification (blocker #2), and at minimum a real messaging channel (blocker #3).
- **Production readiness of what shipped:** the payout system is production-quality (idempotent, best-effort, refund-safe, authorized, tested) — it is *deployed but dormant until live keys + migrations are applied.*

## Recommended next sequence
1. Apply `0011` + `0012`, flip Stripe to live+Connect, run the E2E payout test.
2. Real-time messaging (Supabase Realtime) — the biggest remaining product gap.
3. Booking lifecycle UI + reputation display (fastest wins on top of shipped backends).
4. Onboarding completion gating; provider analytics; perf to 95.
