# iGlamHer — Booking Flow Audit

Traced end-to-end from availability computation through a confirmed booking. File paths cited throughout;
real vs stubbed called out explicitly.

---

## 1. Availability computation (`src/lib/availability/calc.ts`)

Pure, reusable, deterministic engine shared by the profile preview (Phase 3) and the booking flow (Phase 4).
No slot locking happens here — it only *computes* openings. Key invariants (from the file header): all instants are
UTC; working hours are wall-clock minutes in the pro's IANA timezone; DST is handled by computing the zone offset at
the specific instant via `Intl`.

Core types:
- `AvailabilityConfig`: `{ timezone, rules: AvailabilityRule[], exceptions: AvailabilityException[], minNoticeMinutes, maxWindowDays }`.
- `SlotRequest`: `{ date "YYYY-MM-DD", serviceDurationMin, bufferBeforeMin, bufferAfterMin, slotIntervalMin?, now, existingBookings? }`.
- `Slot`: `{ startUtc, endUtc, startLocal "HH:MM" }`.

Helpers: `zoneOffsetMs`, `zonedTimeToUtc` (DST-correct, refines once for DST edges), `weekdayInZone`,
`formatLocalTime`, `subtractIntervals`.

### `computeDaySlots(config, req)` — the algorithm

1. Parse `req.date`. Reject if the day's UTC start is beyond `now + maxWindowDays` (**max booking window**).
2. Determine the weekday-in-zone; set `interval = slotIntervalMin ?? 15`; compute `totalMin = bufferBefore + duration + bufferAfter`.
3. **Working windows** = weekly `rules` matching the weekday, each `start_minute`/`end_minute` converted to a UTC interval.
4. **Extra-hours exceptions** (`isAvailable=true`) overlapping the day are unioned in (clamped to the day).
5. **Blocks** = blocked exceptions (`isAvailable=false`) + `existingBookings`, subtracted via `subtractIntervals`.
6. Step each remaining window on the interval grid. A candidate start `t` is emitted only if the **occupied range**
   `[t − bufferBefore, t + duration + bufferAfter]` sits entirely inside the contiguous window, and `t ≥ now + minNoticeMinutes`
   (**min-notice**). Buffers extend the occupied range; the service itself must fit.

`hasWeeklyAvailability()` is a cheap "does this pro have any weekly hours?" check for the profile preview.
Tested in `src/lib/availability/__tests__/calc.test.ts`.

Backing tables (`supabase/migrations/0001_schema.sql`): `availability_rules` (weekday 0–6, start/end minute, `end>start`)
and `availability_exceptions` (`starts_at`/`ends_at`, `is_available` = blocked vs extra hours).

---

## 2. `AvailabilityPreview` component (`src/components/marketplace/AvailabilityPreview.tsx`)

Client component on the professional profile. Renders **7 days**, calling `computeDaySlots` per day with
`slotIntervalMin: 30`. Shows a horizontal day strip (disabled when 0 slots, "N open" count) and, on selecting a day,
up to 16 slot chips (`startLocal`). Fires the `availability_preview_opened` analytics event. Slots are **display-only**
here — footer reads "Booking opens in the next phase." No booking action.

---

## 3. `/book/[slug]` page (`src/app/book/[slug]/page.tsx`)

Server component, `dynamic = "force-dynamic"`:

1. `getProfessionalBySlug(slug)` → `notFound()` if missing.
2. `publicServices(pro)` (`src/lib/marketplace/visibility.ts`) filters to bookable services; if `?service=<id>` is
   present, that service is sorted first.
3. Builds the `AvailabilityConfig` from the pro: `{ timezone, rules: pro.availability, exceptions: pro.exceptions,
   minNoticeMinutes: 120, maxWindowDays: 60 }`. **Min-notice (2h) and window (60d) are hardcoded here**, not per-service.
4. Renders `<BookingFlow>` with `professionalId=pro.userId`, services, active add-ons, and the config. Empty-state when
   no bookable services.

---

## 4. `BookingFlow` component (`src/components/booking/BookingFlow.tsx`)

Client, 4-step state machine `service → time → review → done` (`Stepper` shows progress). Starts at `time` if the pro
has exactly one service, else `service`.

1. **service** — pick a service (`setServiceId`, advance to `time`).
2. **time** — builds **14 days** via `computeDaySlots` (`slotIntervalMin: 30`). Optional add-on chips toggle
   `addonIds`. Day strip → on select, up to 20 slot chips → selecting a slot advances to `review`.
3. **review** — recomputes the price **client-side** via `computeBooking` (`src/lib/booking/pricing.ts`) for display
   (line items, Total, "Due now (deposit)"). This is preview only — the server recomputes authoritatively.
4. **`confirm()`** — fires `checkout_started` analytics, then `createBookingDraftAction({ professionalId, serviceId,
   startUtc, endUtc, addonIds })`:
   - If it fails and the message matches `/sign in/i` → `window.location.href = /signin?next=<pathname>`.
   - If `res.demo` → show the demo "Booking created" confirmation (no payment).
   - Otherwise (live) → `createCheckoutSessionAction(bookingId)`; if `needsAuth` redirect to sign-in; else
     `window.location.href = checkout.url` (Stripe hosted Checkout).

Note the client's `takeRateBps: 1500` in the preview is cosmetic — the server owns the real number.

---

## 5. Pricing / deposit engine (`src/lib/booking/pricing.ts`)

Pure, integer-cents, deterministic. Model (from the header):
```
subtotal        = service + addons
taxableBase     = max(0, subtotal + travel − discount)
tax             = round(taxableBase * taxRateBps / 10000)
discount        = min(discount, subtotal + travel)
total           = subtotal + travel + tax − discount + tip
commissionBase  = subtotal + travel − discount           (excludes tax & tip)
platformFee     = round(commissionBase * takeRateBps / 10000)
professionalNet = commissionBase − platformFee + tip
amountDueNow    = deposit(total)
```
**Tips and taxes are never in the platform commission base.** `computeBooking` returns a `PriceBreakdown` with all
components + `lineItems`.

`computeDeposit(total, deposit)`:
- `full` / `none` / undefined → `total` (pay in full);
- `percent` → `round(total * pct/100)` (pct clamped 0–100), capped at total;
- `fixed` → `min(total, value)`.

`cancellationFee(deposit, hoursUntilStart)`: ≥48h → free (full refund); 24–48h → 50% fee; <24h → 100% fee
(non-refundable). Tested in `src/lib/booking/__tests__/pricing.test.ts`.

---

## 6. Booking creation server action (`src/lib/booking/actions.ts`, `"use server"`)

`createBookingDraftAction(raw)`:

1. **Kill-switch:** `isBookingsPaused()` (`src/lib/ops/settings.ts`) → friendly "temporarily paused" error.
2. Zod `draftSchema` — `{ professionalId uuid, serviceId uuid, startUtc datetime, endUtc datetime, addonIds uuid[]≤20,
   tipCents 0–100000, notes ≤600 }`.
3. **Authoritative pricing:** `getServiceWithProfessional(serviceId)` (`src/lib/data/professionals.ts`); rejects if the
   service's pro ≠ `professionalId`. Add-ons are filtered to active ones actually owned by the pro; travel fee applied
   only when `service.locationType === 'mobile'`. Then `computeBooking({ …, takeRateBps: 1500, deposit:{ type:
   service.depositType, value: service.depositValue }})`. **Price is never trusted from the client** (comment + code).
4. **Demo mode:** if `!isLiveSupabase()` → returns a synthetic `bookingId = demo-<uuid>` and the breakdown, `demo:true`
   (no DB write).
5. **Live:** `getUser()` (must be signed in → "Please sign in to book."), then RPC `create_booking(...)` with the
   snapshotted amounts and line items. On `SLOT_TAKEN` → "That time was just booked — please choose another slot."
   Returns `{ ok:true, bookingId, breakdown, demo:false }`.

### Atomic creation & no double-booking — `create_booking` RPC (`supabase/migrations/0005_booking_engine.sql`)

SECURITY DEFINER Postgres function, `GRANT EXECUTE ... TO authenticated` (revoked from public):
- Authorizes: `auth.uid()` must equal `p_customer` (or be admin).
- Inserts the `bookings` row with `status='pending_payment'` and all snapshotted cents columns.
- The insert can throw `exclusion_violation` from the `bookings_no_overlap` GiST **exclusion constraint**
  (`0001_schema.sql`): same `professional_id` + overlapping `time_range` where `reserves_time` and status ∈
  (`pending_payment,confirmed,change_requested,in_progress`). The losing concurrent transaction is caught and re-raised
  as `SLOT_TAKEN`. This makes concurrent double-booking impossible at the DB layer.
- Inserts each `booking_line_items` row and a `booking_status_events` row (`pending_payment`, "Booking created").

`bookings` also stores a generated `time_range tstzrange` column and snapshot pricing (`service_name_snapshot`,
`subtotal_cents … total_cents`, `amount_due_now_cents`, `platform_fee_cents`), so later service edits don't mutate
historical bookings.

---

## 7. Status lifecycle (`src/lib/booking/status.ts`)

`BookingStatus` mirrors the `booking_status` enum. Transition graph `GRAPH` encodes legal moves + who may perform them
(`Actor = customer|professional|admin|system`). Highlights:
- `pending_payment → confirmed` **only by `system`** (the payment webhook / success page).
- `pending_payment → cancelled_customer` (customer/system) or `cancelled_professional` (professional/admin).
- `confirmed → in_progress → completed` (professional), plus `no_show`, `disputed`, cancellations.
- `completed → refunded` (admin) or `disputed`. `refunded` is the only `TERMINAL` state.

Helpers: `allowedTransitions`, `canTransition(from,to,by)`, `reservesTime(status)` (which statuses block the calendar —
matches the exclusion-constraint set plus `completed`/`no_show`), `isActive`, `statusLabel`. Tested in
`src/lib/booking/__tests__/status.test.ts`.

`updateBookingStatusAction(bookingId, action, reason?)` maps UI actions (`accept/start/complete/reject/cancel/no-show`)
to `{ to, actor }`, verifies the caller is the correct party (customer or professional on that booking), enforces
`canTransition`, writes the patch (+ `cancelled_at`/`completed_at` timestamps), inserts a `booking_status_events` row,
and on `completed` awards loyalty points via `awardBookingPoints` (idempotent).

---

## 8. Confirmation (`/book/success` — `src/app/book/success/page.tsx`)

The success page confirms from the **paid Stripe session** (not browser auth), so it survives the cross-site return
from Stripe. `confirmFromSession(sessionId)` retrieves the Checkout Session; requires `payment_status === 'paid'` and a
`metadata.bookingId`; then, **idempotently** (only when `status='pending_payment'`), uses the **admin client** to flip
`bookings.status → confirmed` (+ `confirmed_at`, `stripe_payment_intent_id`), upsert the `payments` row, insert a
`confirmed` status event, and **unlock messaging** (`conversations.is_unlocked = true`). Renders a confirmation card or,
if unpaid, a "Payment not completed — it will reconcile shortly" message. (Full money reconciliation is the webhook —
see `13-payment-flow.md`.)

---

## 9. Reading bookings (`src/lib/booking/data.ts`)

`getMyCustomerBookings()` / `getMyProfessionalBookings()` — RLS-scoped selects filtered by `customer_id` /
`professional_id` = `auth.user.id`, joined to `professional_profiles.business_name`. Return `[]` in demo mode or when
unauthenticated. `bookings` RLS (`0003_rls.sql`): parties read; customer-only insert; parties update.

---

## 10. Step-by-step: service+slot → confirmed booking

1. Customer opens `/book/[slug]` (optionally `?service=`). Server builds config (min-notice 120m, window 60d) and renders `BookingFlow`.
2. Pick a service; optionally toggle add-ons; the client computes 14 days of slots via `computeDaySlots` and shows a preview price (`computeBooking`).
3. Pick a slot → **review** step shows line items, Total, and Due-now deposit.
4. Confirm → `createBookingDraftAction`: kill-switch check → Zod → **authoritative re-pricing** from stored service/pro data → auth check → `create_booking` RPC.
5. RPC inserts a `pending_payment` booking; the `bookings_no_overlap` exclusion constraint guarantees the slot wasn't taken concurrently (else `SLOT_TAKEN`). Line items + a `pending_payment` status event are written.
6. Client calls `createCheckoutSessionAction(bookingId)` → redirects to Stripe hosted Checkout for the deposit/total.
7. On payment, Stripe returns to `/book/success?session_id=…`. The page verifies `payment_status='paid'` and idempotently flips the booking to **confirmed**, records the payment, and unlocks messaging. The webhook does the same as the durable source of truth.
8. Post-confirmation, professional/customer drive the lifecycle (`accept/start/complete/…`) via `updateBookingStatusAction`, gated by the status graph.

**Demo mode shortcut:** with Supabase unconfigured, step 4 returns a synthetic `demo-…` booking and the flow jumps
straight to a "Booking created (demo — no payment)" screen (no DB, no Stripe).

---

## 11. Real vs stubbed — summary

**Real & wired:** the availability engine (DST-correct, buffers, min-notice, window, exceptions, existing-booking
subtraction; unit-tested); `AvailabilityPreview`; `BookingFlow`; authoritative server-side re-pricing; the atomic
`create_booking` RPC with the GiST exclusion constraint; the status machine + `updateBookingStatusAction` with
party/transition checks; loyalty award on completion; `/book/success` idempotent confirmation; RLS-scoped booking reads.

**Notable constants / gaps:** `minNoticeMinutes` (120) and `maxWindowDays` (60) are **hardcoded in the page**, not
per-professional/per-service; `takeRateBps` is hardcoded to `1500` (15%) in both the client preview and the draft
action (comment says "professional.take_rate; default 15%" but `professional_profiles.take_rate_bps` is **not** read
here); tax/discount/tip are supported by the engine but the booking flow always passes them as 0/none (no promo or tip
entry in the UI). Demo mode bypasses the DB and Stripe entirely.
