# Phase-12 Production Launch Verification — Stripe Integration

**App:** iGlamHer (Next.js App Router + Supabase + Stripe marketplace)
**Scope:** READ-ONLY audit of `src/lib/payments/*`, `src/app/api/stripe/webhook/route.ts`, `src/lib/booking/pricing.ts`, booking/payment actions, `/book/success`.
**Date:** 2026-07-20
**Legend:** HANDLED / PARTIAL / GAP / NOT-VERIFIABLE-WITHOUT-LIVE-KEYS

---

## Architecture summary (as coded)

- **Payment collection:** Stripe **Checkout Session** (`mode: "payment"`, hosted), created server-side in `src/lib/payments/actions.ts`. Amount = `amount_due_now_cents` read from the persisted booking. Checkout is a **plain platform charge** — it does **not** use Connect `transfer_data`/`application_fee` (see actions.ts:35-37 note).
- **Provider payout:** Separate **"separate charges + transfers"** model in `src/lib/payments/payouts.ts` — the webhook fires a `stripe.transfers.create` to the pro's connected account after the charge lands on the platform. This is a different code path from the (unused) destination-charge helper in `stripe.ts:40-55` (`createBookingPaymentIntent`, currently **not called anywhere** in the checkout flow).
- **Source of truth:** the **webhook** (`route.ts`). `/book/success` is a secondary, idempotent confirmation using the Stripe session as proof.
- **Money math:** `src/lib/booking/pricing.ts`, pure integer-cents, deterministic.

---

## Scenario-by-scenario

### 1. Deposit vs full payment — HANDLED (collection) / see GAP #2
- `computeDeposit()` supports `full | percent | fixed | none` — pricing.ts:97-105.
- Checkout charges exactly `amount_due_now_cents` — actions.ts:46 (`unit_amount: b.amount_due_now_cents`), which is the deposit output of `computeDeposit` persisted at draft time (booking/actions.ts:84 `p_due_now: breakdown.amountDueNowCents`).
- Current live default deposit type is whatever the service row carries (`service.depositType`, booking/actions.ts:54). Take-rate is hard-coded 1500 bps (booking/actions.ts:53).

### 2. Remaining-balance handling — GAP
- There is **no code path that collects the remaining balance** when `amount_due_now_cents < total_cents` (i.e. a percent/fixed deposit). No second checkout, no "balance due" action, no schema column tracking it.
- **Worse — payout over-pays:** the pro payout is computed from the **full** `total_cents`, not from what was actually collected: `payoutAmountCents(total_cents, platform_fee_cents)` at route.ts:87 and payout-actions.ts:41. If only a partial deposit was charged, `transferBookingPayout` would still try to transfer net of the full total. **Safe only while every service uses a `full` deposit.** Flag before enabling percent/fixed deposits in production.

### 3. Platform fee calc — HANDLED
- `platformFee = round(commissionBase * takeRateBps / 10000)`, `commissionBase = subtotal + travel − discount` — pricing.ts:66-68. Tax and tip are correctly **excluded** from the commission base (pricing.ts:66 comment + math). `professionalNet = commissionBase − platformFee + tip` (pricing.ts:69). Persisted as `platform_fee_cents` (booking/actions.ts:85). Unit-tested (`src/lib/booking/__tests__/pricing.test.ts`).

### 4. Provider transfer (Connect) — HANDLED in code / DORMANT (see dormancy note)
- `transferBookingPayout` — payouts.ts:29-119: checks connected-account eligibility (`stripe_account_id && connect_payouts_enabled && !payouts_frozen`, payouts.ts:56), calls `stripe.transfers.create` with `idempotencyKey: payout_<bookingId>` (payouts.ts:83), records `payout_transfers` row + flips `earnings_ledger` to paid.
- Eligibility is derived from **Stripe's own flags** via `syncConnectStatus` (connect.ts:54-76), not self-reported. Good.
- **Dormant:** writes to `payout_transfers` (migration **0012**, not yet applied) — every transfer attempt will hit a missing table and land in the `catch` as `status:"failed"` (best-effort, never throws — payouts.ts:104-118), so confirmation is not blocked, but **no pro actually gets paid** until 0012 + Connect + live keys are live.

### 5. Refund (full) — PARTIAL
- Webhook **reacts** to `charge.refunded`: marks payment `refunded` when fully refunded, reverses the transfer proportionally — route.ts:128-157. Correct handling of the *inbound* event.
- **GAP:** there is **no code that initiates a refund** anywhere (`grep` for `refunds.create` → 0 hits). A full refund must be triggered **manually in the Stripe dashboard**. The booking `status → refunded` transition is admin/system-only (status.ts:51-56) and is not auto-driven by the refund webhook (route.ts only touches the `payments` row + ledger, not `bookings.status`).

### 6. Partial refund — PARTIAL
- Webhook **correctly distinguishes** partial vs full: `fullyRefunded = charge.refunded === true || amount_refunded >= amount` (route.ts:141-143) → sets `partially_refunded` vs `refunded`. Proportional transfer reversal via `reverseBookingPayout` (payouts.ts:122-150, clamps to transferred amount, idempotency key includes the cents). Enum supports `partially_refunded` (migration 0001:18).
- Same **GAP** as #5: no in-app initiation; dashboard-only. Reversal is also dormant until `payout_transfers` exists (0012).

### 7. Cancellation — PARTIAL
- Status machine handles all cancellation transitions and actor authorization (status.ts:24-59; booking/actions.ts:99-152). `payment_intent.canceled` webhook sets booking `cancelled_customer` (guarded on `pending_payment`) — route.ts:120-125.
- `cancellationFee()` computes tiered fee/refund (>48h free, 24-48h 50%, <24h 100%) — pricing.ts:111-121, unit-testable — **but it is not wired to any refund/payout action.** Cancelling a **confirmed/paid** booking does **not** trigger any Stripe refund. GAP: cancellation → refund is manual.

### 8. Failed payment (card declined) — HANDLED
- `payment_intent.payment_failed` upserts payment `status:"failed"` keyed on the PI (route.ts:111-117). Booking stays `pending_payment`, so the customer can retry via Checkout — reasonable. (Checkout itself handles the decline UX on Stripe's hosted page — NOT-VERIFIABLE-WITHOUT-LIVE-KEYS for live decline behavior, but the state transition is correct.)

### 9. Payment abandoned / expired checkout — PARTIAL
- Only `payment_intent.canceled` is handled (route.ts:120). **`checkout.session.expired` is NOT handled** and its cancel path relies on Stripe eventually canceling the PI. An abandoned Checkout (user closes tab) leaves the booking in `pending_payment` and continues to **reserve the time slot** (`reservesTime()` includes `pending_payment`, status.ts:73-74) until/unless a `payment_intent.canceled` fires. GAP: no timeout sweep and no `checkout.session.expired` subscription. Consider subscribing to that event or a cron sweep.

### 10. Duplicate payment submission — HANDLED
- Payments are upserted `onConflict: "stripe_payment_intent_id"` (route.ts:71, success page:42), and the booking confirm is guarded `.eq("status","pending_payment")` (route.ts:78, success:39). A second success/PI for the same booking converges — no double-confirm, no duplicate payment row.

### 11. Duplicate webhook delivery — HANDLED
- Exactly-once gate: every `event.id` is inserted into `stripe_events` **before** side effects; a unique-violation (`23505`) is acknowledged as `duplicate` and skipped (route.ts:43-49). On processing failure the marker is rolled back so Stripe's retry re-attempts (route.ts:54-59). Table defined migration 0009:11-16.

### 12. Webhook signature verification — HANDLED
- `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)` on the **raw** request text (`req.text()`, route.ts:30-34). Missing sig → 400 (route.ts:28); bad sig → 400 (route.ts:35-36). Rejects if `STRIPE_WEBHOOK_SECRET` unset → 503 (route.ts:24). Correct.

### 13. Idempotency — HANDLED (layered)
- (a) `stripe_events` dedup; (b) status-guarded booking updates; (c) upserts keyed on PI / `booking_id,kind` (earnings_ledger route.ts:96) / `booking_id` (payout_transfers); (d) **Stripe idempotency keys** on `transfers.create` (`payout_<bookingId>`, payouts.ts:83) and `createReversal` (`reverse_<bookingId>_<cents>`, payouts.ts:140). Strong.

### 14. Payment ↔ booking status sync — HANDLED
- Both the webhook (route.ts:74-82) and `/book/success` (success:34-46) drive `bookings.status pending_payment → confirmed`, insert a `booking_status_events` audit row, and unlock the conversation — all idempotent. Whichever runs first wins; the other no-ops on the status guard.

### 15. "Webhook before redirect" vs "redirect before webhook" — HANDLED
- Both orderings converge because both paths are guarded on `pending_payment` and use idempotent upserts. If the webhook lands first, the success page's guarded update is a no-op; if the browser returns first, the webhook's is. No race hazard on booking state.

### 16. Payment succeeds but redirect fails — HANDLED
- The webhook is the independent source of truth (route.ts:9 comment + logic). Even if the browser never reaches `/book/success`, `payment_intent.succeeded` confirms the booking, records the payment, unlocks messaging, and initiates payout. Robust.

---

## Cross-cutting assessments

### Are all amounts computed server-side (never trusted from client)? — HANDLED
- Client sends **only `bookingId`** to `createCheckoutSessionAction` (BookingFlow.tsx:99). The server re-reads `amount_due_now_cents` from the DB (actions.ts:22-46). Draft pricing is recomputed server-side from stored service/add-on data (booking/actions.ts:37-55, Zod-validated input, add-ons filtered to active rows). Payout amounts derive from persisted `total_cents`/`platform_fee_cents`. No client-supplied money value is ever charged or paid. **Tip** is the only client-supplied amount, clamped 0…$1000 and Zod-validated (booking/actions.ts:20). Clean.

### Is /book/success safe (auth vs stripe-session proof)? — HANDLED (with one note)
- Trust model = the **Stripe session** (`payment_status === "paid"`, success:18), not browser auth — deliberate, so it survives the cross-site return from Stripe (success:11-13). Uses the admin client and confirms idempotently guarded on `pending_payment`. The `session_id` is an unguessable Stripe token, so it functions as bearer proof of payment.
- **Note (low):** the page does not verify the returning browser owns the booking — anyone with the `session_id` could load the confirmation view and see `service_name_snapshot` + `total`. Low severity (token is unguessable, data is non-sensitive, no state change beyond the idempotent confirm the webhook also does). Acceptable for launch; worth a note.

---

## Code-complete but DORMANT until live keys + migrations 0011/0012

These are implemented and correct in code but **inert / will error-and-swallow** in current production:

1. **`payout_transfers` table (migration 0012 — NOT applied).** All of `transferBookingPayout` / `reverseBookingPayout` (payouts.ts) and `retryBookingPayoutAction` (payout-actions.ts) read/write this table. Until 0012 is applied, every transfer attempt fails silently (best-effort catch, route.ts:100-105 / payouts.ts:104-118) → **no pro is paid, no payout is reversed on refund.** Booking confirmation is unaffected.
2. **`redeem_loyalty_points` RPC (migration 0011 — NOT applied).** Not part of the Stripe charge path, but the confirmed-missing RPC; loyalty redemption → account credit is dormant. (Loyalty *award* on completion, booking/actions.ts:148, writes to tables from earlier migrations and is independent.)
3. **Stripe Connect provider transfers generally** — dormant until (a) Connect is enabled on the live Stripe account, (b) pros complete Express onboarding (`connect_payouts_enabled` true), and (c) live keys are set. Checkout meanwhile captures 100% to the platform (actions.ts:35-37), to be reconciled on payout — so **funds are safe, they just accumulate on the platform** until payouts go live.
4. **Live-key-gated behaviors — NOT-VERIFIABLE-WITHOUT-LIVE-KEYS:** actual card-decline UX, real Checkout session creation/expiry timing, transfer/refund settlement, and webhook signature against the *live* endpoint secret. Code paths are present and correct; end-to-end behavior needs a live/test key run.

---

## Operator checklist — exact steps to go live

**Env vars (Vercel → iglamher-app → Settings → Environment Variables, Production):**
1. `STRIPE_SECRET_KEY` = **live** secret key (`sk_live_…`). Gates `isStripeConfigured()` — nothing charges until set.
2. `STRIPE_WEBHOOK_SECRET` = the **live** endpoint's signing secret (`whsec_…`) from the step below. Without it the webhook returns 503.
3. `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` / publishable key (`pk_live_…`) if referenced client-side, and confirm `NEXT_PUBLIC_APP_URL = https://iglamher-app.vercel.app` (used to build success/cancel + Connect return URLs).

**Database:**
4. Apply migrations **0011** (`redeem_loyalty_points`) and **0012** (`payout_transfers`) to the production Supabase project **before** enabling payouts — otherwise transfers silently fail.

**Stripe Dashboard:**
5. **Developers → Webhooks → Add endpoint:** URL = `https://iglamher-app.vercel.app/api/stripe/webhook`. Copy the signing secret into `STRIPE_WEBHOOK_SECRET`.
6. **Subscribe to exactly these event types** (the only ones the handler acts on — route.ts:63-158):
   - `payment_intent.succeeded`
   - `payment_intent.payment_failed`
   - `payment_intent.canceled`
   - `charge.refunded`
   - *(recommended add — see GAP #9):* `checkout.session.expired` (currently unhandled; subscribing alone won't fix it — needs a handler, but subscribe so the data is available).
7. **Connect → enable** (Express accounts) and complete the platform Connect profile. Required capabilities requested in code: `transfers` + `card_payments` (connect.ts:33).
8. **Confirm the `stripe` npm package is installed** in the deployed build (getStripe throws a clear error if not — stripe.ts:19-21).

**Post-cutover smoke test (test mode first):**
9. Run one full booking → Checkout → success, and verify: booking `confirmed`, `payments.succeeded`, `booking_status_events` row, conversation unlocked, and (after 0012 + an onboarded pro) a `payout_transfers` row = `paid`. Then trigger a dashboard refund and confirm `charge.refunded` flips the payment to `refunded`/`partially_refunded` and reverses the transfer.

---

## Top risks to address before/at launch (priority order)
1. **GAP #2** — remaining-balance / partial-deposit over-payout. Keep all services on `full` deposit OR fix payout to derive from amount actually collected, before enabling percent/fixed deposits.
2. **GAP #5/#6/#7** — no in-app refund/cancellation-refund initiation; all refunds are manual dashboard actions. Fine for a controlled launch if the ops team knows; otherwise build an admin refund action calling `stripe.refunds.create`.
3. **GAP #9** — abandoned/expired Checkout leaves a `pending_payment` booking holding the slot. Add a `checkout.session.expired` handler or a sweep job.
4. **Dormancy** — apply migrations 0011/0012 and enable Connect, or pros never get paid (funds sit on platform).
