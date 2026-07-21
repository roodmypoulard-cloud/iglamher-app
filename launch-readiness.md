# iGlamHer — Launch Readiness (Final)

**Date:** 2026-07-20 · **Env:** Vercel prod + Supabase + Stripe (test mode)
Consolidated after the full production audit ([`/audit`](./audit/00-README.md)) and Phases 10–11. This supersedes earlier drafts.

---

## Completion

| Scope | Completion |
|---|---|
| **Private beta** (Stripe test mode) | **~93%** |
| **Public launch** (real money to pros) | **~80%** |

Every dead placeholder screen is now a real, connected screen. The core customer journey (discover → search → profile → book → pay → confirm → **booking history** → **message**) and the pro journey (services → availability → payouts onboarding → earnings) work end-to-end and were verified against the live DB with a signed-in test account.

---

## What is done and verified

### Placeholders removed — verified with a signed-in user
- **`/bookings`** — fetches real customer bookings, grouped **Upcoming / Past**, with status chips (Confirmed, Awaiting payment, Completed, Cancelled…), date, pro name, price. *Verified: renders two real bookings for the test customer.*
- **`/messages`** — real conversation list (other party, last-message preview, locked/unlocked) + **thread view** (`/messages/[id]`) + **composer** wired to the existing contact-guarded `sendMessageAction`. Proper empty state; protected route redirects unauthenticated users to sign-in. *Verified rendering + auth gating.*
- Removed the stale `"Placeholder until payments phase"` service-form hint.

### Payments & payouts (Phase 11)
- **Stripe Connect payout transfers** — separate charges + transfers; the webhook transfers each pro's **net earning** to their connected account on `payment_intent.succeeded` and **reverses proportionally** on refund. Idempotent per booking (`payout_transfers` unique + Stripe idempotency key), best-effort (never blocks confirmation), with a **failed-payout recovery** action. Flow: customer → platform (keeps commission) → professional. *Backend complete + unit-tested; dormant until live keys + migrations applied.*
- **Partial-refund bug fixed** — a partial refund can no longer be recorded as a full refund.

### Growth integrity (Phase 10)
- **Loyalty redemption is atomic** — conditional-debit RPC removes the double-spend race.
- **Referral fraud hardened** — real IP / account-age / per-referrer + per-IP velocity signals, written to a `referral_audit` log.
- **Reputation engine** (metrics + Top Pro / New / Verified badges) built + unit-tested (profiles already show a working `TrustBadges` set today).

### Performance
- Hero → `next/image priority`: Lighthouse **72 → 84**, LCP **5.7 → 4.2 s**, Speed Index **7.7 → 3.6 s**. Accessibility **100**, SEO **100**, Best-Practices **96**, CLS ~0.

### Quality gates
`tsc` clean · ESLint clean · **160/160 unit tests pass** · production build clean · deployed.

---

## Remaining launch blockers

### 🔴 Before real-money public launch
1. **Apply migrations `0011` + `0012`** to the live DB (Supabase SQL editor; idempotent) — the atomic loyalty RPC, `referral_audit`, and `payout_transfers` live there.
2. **Switch Stripe to live keys with Connect enabled**, then **verify one live E2E payout** (charge → transfer → pro paid → refund → reversal). The only step that cannot be self-verified.

### 🟠 Polish / completeness (not blockers for a limited private beta)
3. **Booking lifecycle UI** — customer reschedule/cancel and pro accept/reject/complete/no-show aren't surfaced (state machine + atomic backend exist; wire `updateBookingStatusAction` via the admin client to avoid the `0005` guard).
4. **Onboarding gating** — "hidden from search until 100%" + completion checklist/% (service/availability/Connect editing already exist).
5. **Richer messaging** — basic thread + guarded send works; real-time (typing, read receipts, image sharing) not built.
6. **Reputation display** — surface the new badge engine on profiles/search.
7. **Performance to 95** — smaller hero source + preload; wire Redis-backed rate limiting.

---

## Production checklist

| Area | Status |
|---|---|
| Authentication (Supabase, roles, callback, safe redirects) | ✅ Working |
| Search + filtering + recommendations | ✅ Working |
| Categories (5 incl. Nails; grid + banner) | ✅ Working |
| Professional profiles + portfolio + reviews | ✅ Working |
| Booking create (availability engine, atomic, no double-booking) | ✅ Working |
| Booking history (`/bookings`) | ✅ **Wired to real data** |
| Booking lifecycle UI (reschedule/cancel/accept) | 🟠 Backend ready; UI not surfaced |
| Payments (Checkout, server-set amounts, idempotent webhook) | ✅ Working (test mode) |
| Payouts (Connect onboarding + **transfer split + reversal**) | ✅ **Wired**; needs live keys + `0012` |
| Refunds (partial/full correct) | ✅ Fixed |
| Loyalty (atomic redemption) | ✅ Fixed (needs `0011` live) |
| Referrals (fraud-hardened + audit) | ✅ Fixed (needs `0011` live) |
| Reviews / ratings / favorites | ✅ Working |
| Messaging (conversation list, thread, guarded send) | ✅ **Wired** (real-time extras pending) |
| Notifications (in-app + push tokens + prefs) | ✅ Infra present; per-flow triggers partial |
| Onboarding (completion %/gating) | 🟠 Editing works; gating pending |
| Provider dashboard (services, availability, earnings) | ✅ Working |
| Admin dashboard (analytics, campaigns, trust & safety) | ✅ Working |
| Email confirmations | ⚠️ Verify provider wiring per flow |
| Database + RLS (deny-by-default, column guards) | ✅ Strong |
| Security (webhook verified, server-side money, secrets partitioned) | ✅ Strong |
| Performance | 🟠 84/100 |
| Accessibility | ✅ 100/100 |
| Responsive (390/768/1024/1440) | ✅ Verified |

## Performance metrics

| Metric | Before | After | Target |
|---|---|---|---|
| Performance | 72 | **84** | 95 |
| LCP | 5.7s | **4.2s** | < 2.5s |
| Speed Index | 7.7s | **3.6s** | — |
| TBT | 20ms | 20ms | < 200ms ✅ |
| CLS | 0 | 0.03 | < 0.1 ✅ |
| Accessibility / SEO / Best-Practices | 100 / 100 / 96 | (unchanged) | — |

## Security verification

- ✅ RLS deny-by-default + column guards (no self-verify/self-feature/price-zeroing/review-forging).
- ✅ Stripe webhook signature-verified, deduped (`stripe_events`), idempotent; all amounts server-side.
- ✅ Service-role key `server-only`; nothing sensitive in `NEXT_PUBLIC_*`.
- ✅ Bookings can't double-book (GiST exclusion via `create_booking`).
- ✅ Loyalty double-spend closed (atomic RPC). ✅ Referral Sybil abuse reduced (signals + velocity + audit).
- ✅ Messaging contact-info guard enforced server-side before booking unlock.
- 🟠 Rate limiting only on auth (Redis limiter written, not fully wired).

## Verdict

- **Private beta (Stripe test mode): READY** once migrations `0011`/`0012` are applied. Critical journeys are connected, safe, and verified with real data.
- **Public launch (live money): NOT YET** — needs live Stripe/Connect keys and the one live-payout E2E verification (blocker #2). No architectural work remains for payouts.

## Recommended next steps
1. Apply `0011` + `0012`; flip Stripe to live + Connect; run the payout E2E test → clears the public-launch blocker.
2. Booking-lifecycle UI + reputation display (fast wins on shipped backends).
3. Onboarding gating; richer real-time messaging; performance to 95.
