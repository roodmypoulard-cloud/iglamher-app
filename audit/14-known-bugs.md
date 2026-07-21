# iGlamHer — Known & Likely Bugs

**Method:** Read of the actual source for correctness defects, races, fail-open behavior, app↔DB mismatches, and money-math divergence. Each item gives `file:line`, a concrete failure scenario, severity, and a fix. Trivial style nits excluded.
**Date:** 2026-07-19

Split into **Confirmed** (the code provably does the wrong thing) and **Suspected / Needs verification**.

---

## Confirmed

### B1 — Column guard makes it impossible for a pro to start/complete a booking (app↔DB mismatch)

**Where:** `src/lib/booking/actions.ts:110-152` (uses the **user-scoped** client at :143) vs. `supabase/migrations/0005_column_guards.sql:80-83`.

```sql
-- guard_booking_columns (runs on any non-service, non-admin UPDATE)
if new.status is distinct from old.status
   and new.status in ('confirmed', 'in_progress', 'completed', 'refunded', 'disputed') then
  raise exception 'booking status % is set by the platform only', new.status;
end if;
```

`updateBookingStatusAction` performs `supabase.from("bookings").update({ status: move.to })` as the **authenticated professional** (not the service role) for `start` → `in_progress` and `complete` → `completed` (`STATUS_ACTIONS`, :99-106). Both target statuses are in the guard's blocklist.

**Failure scenario:** With a live DB, a professional taps "Start" or "Complete." The status transition is legal per `status.ts` (`confirmed→in_progress` / `in_progress→completed` `by: ["professional"]`, `status.ts:44-45`), so it passes `canTransition`, reaches the UPDATE, and the DB trigger **raises `booking status in_progress is set by the platform only`**. The action returns that Postgres error. Bookings can never reach `completed` through this action → **loyalty points are never awarded** (the `awardBookingPoints` call at :148-150 is unreachable), and earnings are never created (the webhook only handles payment, not service completion).

**Mitigating fact:** `updateBookingStatusAction` is currently **not wired to any component** (grep finds only its definition), so this is latent — but it will fire the moment the pro dashboard calls it.

**Fix:** Perform server-driven settlement transitions (`confirmed`/`in_progress`/`completed`) through the **service-role admin client** after the app verifies the actor is a party and the transition is legal — exactly as the webhook does for `confirmed`. Keep customer/pro cancellations on the user client (the guard already allows those).

---

### B2 — `accept` action can never succeed (dead transition)

**Where:** `src/lib/booking/actions.ts:100` maps `accept: { to: "confirmed", actor: "professional" }`, but `src/lib/booking/status.ts:26` allows `pending_payment → confirmed` only `by: ["system"]`.

**Failure scenario:** A pro invokes `accept`. `canTransition("pending_payment", "confirmed", "professional")` returns `false` (:68-70), so the action always returns `Cannot accept a pending_payment booking.` The mapping is misleading dead code — confirmation is intended to happen only via the payment webhook (correct design), so the `accept` entry should not exist.

**Severity:** Low (design says webhook confirms; the stray mapping just can't fire). **Fix:** remove `accept` from `STATUS_ACTIONS`, or make it an admin-only override that runs on the service-role client.

---

### B3 — Professional earnings & payouts include tax (money math divergence)

**Where:** `src/app/api/stripe/webhook/route.ts:88-95` and `supabase/functions/payout-processor/index.ts:30`.

```ts
// webhook: earnings_ledger
amount_cents: (row.total_cents ?? 0) - (row.platform_fee_cents ?? 0),
```
```ts
// payout-processor
const netCents = (b.total_cents ?? 0) - (b.platform_fee_cents ?? 0);
```

But the pricing engine defines the pro's net as **excluding tax** (`src/lib/booking/pricing.ts:12,66-69`):

```
professionalNet = subtotal + travelFee + tip - platformFee   // tax NOT included
```

`total_cents` = `subtotal + travel + tax - discount + tip` (pricing.ts:64). So `total - platformFee` = `professionalNet + tax`. The provider is credited the **collected sales tax** on top of their earnings.

**Failure scenario (when tax is enabled):** service $100, tax $9.50, tip $10, platform fee 15% of $100 = $15. Correct `professionalNet` = $95.00. Ledger/payout credit = `119.50 − 15 = $104.50` → pro over-paid by **$9.50 (the entire tax)**; the platform pays out money it must remit as tax.

**Mitigating fact:** `createBookingDraftAction` never sets `taxRateBps` (`booking/actions.ts:48-55`), so `tax` is currently always `0` → **latent** today, live the moment tax is turned on.

**Fix:** Compute earnings from `professional_net_cents` (persist `breakdown.professionalNetCents` on the booking and use it), never `total − platform_fee`. Apply the same fix in the edge function.

---

### B4 — `charge.refunded` always records a FULL refund (partial refunds mishandled)

**Where:** `src/app/api/stripe/webhook/route.ts:124-131`.

```ts
const fullyRefunded = true; // charge.refunded fires per refund; treat as refunded state
await admin.from("payments").update({ status: fullyRefunded ? "refunded" : "partially_refunded" })...
await admin.from("earnings_ledger").upsert(
  { ..., kind: "refund_adjustment", amount_cents: -(charge.amount_refunded ?? 0), status: "available" },
  { onConflict: "booking_id,kind" });
```

`fullyRefunded` is hardcoded `true`, and the ledger uses `charge.amount_refunded` (Stripe's **cumulative** refunded total for the charge).

**Failure scenario 1 (status):** A $20 partial refund on a $100 booking sets `payments.status = "refunded"` even though $80 was captured — the booking now reads as fully refunded to both parties and any downstream logic keyed on that status.

**Failure scenario 2 (double-count on multiple partials):** `charge.refunded` fires once per refund, and `amount_refunded` is cumulative. Refund $20 then another $20: first event posts `-2000`; the second event has `amount_refunded = 4000` and posts `-4000` — but `onConflict: "booking_id,kind"` **upserts (overwrites)** rather than sums, so the ledger ends at `-4000` (correct total by luck of the cumulative field + overwrite), while the *first* interpretation as a single full-refund line is wrong for reporting and the `status` is wrong in both cases.

**Fix:** Read the actual charge to determine full vs partial (`charge.amount_refunded === charge.amount`), set `status` accordingly, and derive the adjustment from the cumulative refunded amount deliberately (upsert-to-absolute is fine only if you always use the cumulative value — document that invariant). Don't hardcode `fullyRefunded`.

---

### B5 — Loyalty redemption race → double-spend

**Where:** `src/lib/loyalty/actions.ts:26-33`. (Cross-listed as **H1** in `15-security-issues.md`.)

Non-atomic read → `canRedeem` check → unconditional `points = points - cost` write + `account_credits` insert, on the service-role client with no `WHERE points >= cost` and no transaction.

**Failure scenario:** Two concurrent `redeemPointsAction` calls both read the same balance, both pass the check, both insert credit; the balance write is last-writer-wins. User obtains 2× credit for 1× points; balance can go negative.

**Fix:** Atomic conditional debit in a DB function (`UPDATE ... WHERE points >= cost RETURNING`), issue credit only if a row changed, both in one transaction.

---

## Suspected / Needs verification

### S1 — `awardBookingPoints` check-then-insert / read-modify-write race

**Where:** `src/lib/loyalty/award.ts:13-31`. Selects an existing `earn_booking` row, then reads balance, computes, and upserts. Two concurrent completion events could both pass the existence check (double award) or clobber the balance update.

**Why suspected not confirmed:** Completion is normally single-path, and after B1 is fixed the trigger of concurrency depends on how completion is wired. **Fix:** enforce a unique `(booking_id, reason)` constraint and use an atomic `points = points + delta` increment; treat unique-violation as "already awarded."

### S2 — Rate limiting is ineffective on serverless

**Where:** `src/lib/security/rate-limit.ts` (`MemoryStore` default) is the only limiter actually used; `src/lib/cache/redis.ts:79` `redisRateLimit` is never imported. On multi-instance deploys the auth throttle resets per instance / per cold start. **Needs verification** against the actual deploy topology (single vs. multi-instance). **Fix:** wire `redisRateLimit` when Redis is configured. (Cross-listed M1.)

### S3 — Edge functions may be publicly invokable

**Where:** `supabase/functions/payout-processor/index.ts:8`, `booking-reminders/index.ts`. No in-handler auth; rely on Supabase's default JWT gate. If deployed `--no-verify-jwt`, both are open. Payout damage is bounded (transfers are a `TODO`, `payout_records` insert is idempotent), reminders could be spammed. **Verify** deploy flags; add a shared-secret header check.

### I — `take_rate_bps` per professional is ignored

**Where:** `src/lib/booking/actions.ts:53` hardcodes `takeRateBps: 1500` with the comment `professional.take_rate; default 15%`, while `0005_column_guards.sql:33-38` treats `take_rate_bps` as a real admin-managed per-pro column. Every booking bills 15% regardless of the pro's configured rate.

**Failure scenario:** Admin sets a promotional 10% rate for a pro; the booking still computes platform fee at 15%, over-charging the platform commission and under-paying the pro relative to the agreed rate. **Confirmed logic gap; impact depends on whether per-pro rates are used in practice** — hence listed here for verification of business intent. **Fix:** load `professional.take_rate_bps` (already fetched via `getServiceWithProfessional`, or select it) and pass it into `computeBooking`.

---

## Notes on things that are NOT bugs (checked and cleared)

- **Booking pricing discount/tax interaction** (`pricing.ts:60-64`): discount is applied once to the taxable base and once to the total — net effect is a single discount with tax computed on the discounted base. Correct.
- **`safeFilename` path traversal** (`pro/schemas.ts:63`): non-`[a-z0-9.]` chars (including `/` and `\`) are collapsed to `-`; the result is a single path segment appended under a fixed `${userId}/` prefix. `..` survives but cannot traverse without a slash. Safe.
- **Webhook idempotency / ordering** (`webhook/route.ts`): dedup-first + status-guarded updates + `onConflict` keys make repeated/out-of-order deliveries converge. Correct (aside from B4's refund handling).
- **Demo/live split** (`isLiveSupabase()`): actions consistently short-circuit in demo mode with explicit errors rather than pretending success. Good — the one real demo/live mismatch is B1 (guard vs. user-client), which only bites in live mode.
