# iGlamHer — Payment Flow Audit

Traced end-to-end: Stripe Checkout creation → webhook (source of truth) → Connect payouts → earnings ledger.
File paths cited; real vs stubbed called out.

---

## 1. Stripe SDK surface (`src/lib/payments/stripe.ts`, `import "server-only"`)

- `isStripeConfigured()` → `Boolean(process.env.STRIPE_SECRET_KEY)`.
- `getStripe()` — **lazy** import of the `stripe` package, cached; **throws a clear, catchable error** if the key is
  missing ("Stripe is not configured…") or the package isn't installed. So the app builds/runs without Stripe, and no
  code path can fake a successful charge.
- `createBookingPaymentIntent(input)` — builds a **destination-charge PaymentIntent**: `automatic_payment_methods`
  enabled (Apple/Google Pay + cards), `metadata.bookingId/customerId`, and when a
  `professionalStripeAccountId` is supplied → `application_fee_amount` (platform commission) +
  `transfer_data.destination` (the connected account). **STUBBED / NOT WIRED:** grep shows this function is defined but
  **never called** anywhere in `src/`. It is the intended Connect split path but is currently dead/reserved code.

Config keys (`.env.example`, validated for staging/prod in `src/lib/env.ts` `REQUIRED_LIVE`): `STRIPE_SECRET_KEY`
(`sk_test_…`/`sk_live_…`, server only), `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` (`pk_…`, client), `STRIPE_WEBHOOK_SECRET`
(`whsec_…`, "SOURCE OF TRUTH").

---

## 2. Checkout creation — the ACTUAL live path (`src/lib/payments/actions.ts`, `"use server"`)

`createCheckoutSessionAction(bookingId)` is what `BookingFlow` calls. Steps:

1. Guard: `isLiveSupabase()` and `isStripeConfigured()` — else friendly errors.
2. `getUser()` → `{ needsAuth:true }` if not signed in.
3. **Authoritative read:** selects the booking; requires `customer_id === auth.user.id` and
   `status === 'pending_payment'`. The amount is taken from the persisted `amount_due_now_cents` — **never from the
   client**.
4. `stripe.checkout.sessions.create({ mode:'payment', line_items:[{ price_data:{ currency:'usd',
   product_data:{ name:"iGlamHer — <service>" }, unit_amount: amount_due_now_cents }, quantity:1 }],
   metadata:{ bookingId }, payment_intent_data:{ metadata:{ bookingId }}, customer_email,
   success_url: <APP_URL>/book/success?session_id={CHECKOUT_SESSION_ID}, cancel_url: <APP_URL>/account })`.
5. Returns the hosted Checkout `url` for the browser to redirect to.

**Important gap (explicit in-code comment):** this Checkout session does **NOT** set a destination charge / Connect
split. The comment reads: *"destination-charge split to the stylist's connected account is added once professionals
complete Stripe Connect onboarding. Until then the deposit is captured to the platform and reconciled on payout."* So
today **all funds land on the platform account**; the split is reconciled later via the earnings ledger + payout
processor (§5–6), not at charge time. `bookingId` rides on **both** the session and the PaymentIntent metadata so the
webhook and success page can both resolve it.

---

## 3. Webhook — the source of truth (`src/app/api/stripe/webhook/route.ts`)

`POST` handler. Correctness guarantees (from the header): signature-verified; exactly-once via `stripe_events`;
idempotent side effects; returns 200 on handled/duplicate, 500 only on genuine failure so Stripe retries transient
errors but not duplicates.

1. If Stripe or `STRIPE_WEBHOOK_SECRET` missing → 503. Missing `stripe-signature` → 400.
2. `stripe.webhooks.constructEvent(rawBody, sig, STRIPE_WEBHOOK_SECRET)` — invalid signature → 400.
3. Demo mode (`!isLiveSupabase()`) → `{ received:true, note:"no db" }` (acknowledged, no-op).
4. **Exactly-once gate:** `admin.from("stripe_events").insert({ id: event.id, type })` **first**. Unique-violation
   (`23505`) → duplicate delivery → `{ received:true, duplicate:true }` (side effects skipped). Any other insert error
   → captured + 500 (Stripe retries).
5. `handleEvent(admin, event)` runs the side effects. On throw → the dedup marker is **deleted** (so Stripe's retry can
   re-attempt) → 500. On success → `{ received:true }`.

All side effects use the **service-role admin client** (`src/lib/supabase/admin.ts`), bypassing RLS.

`stripe_events` table (`supabase/migrations/0009_launch_ops.sql`): `id text PK (evt_…)`, `type`, `processed_at`; RLS
enabled (service-role only).

### Events handled

- **`payment_intent.succeeded`** — reads `metadata.bookingId` (returns if absent). Then:
  1. Upsert `payments` (`status='succeeded'`, `amount_cents`, `stripe_payment_intent_id`) on conflict of
     `stripe_payment_intent_id`.
  2. Confirm the booking **only if still pending**: `update bookings set status='confirmed', confirmed_at,
     stripe_payment_intent_id where id=bookingId and status='pending_payment'` (guards out-of-order/late delivery),
     returning `professional_id, total_cents, platform_fee_cents`.
  3. Insert a `confirmed` `booking_status_events` row ("Payment succeeded (webhook)").
  4. **Unlock messaging:** `conversations.is_unlocked = true` for the booking.
  5. **Earnings ledger:** upsert `earnings_ledger` `{ kind:'earning', amount_cents: total − platform_fee,
     status:'pending' }` on conflict `(booking_id,kind)` (idempotent).
- **`payment_intent.payment_failed`** — upsert `payments` `status='failed'`.
- **`payment_intent.canceled`** — set the booking `cancelled_customer` (reason "Checkout expired/cancelled") only while
  still `pending_payment`.
- **`charge.refunded`** — resolve `booking_id` from `payments` by PI; set `payments.status='refunded'`; upsert
  `earnings_ledger` `{ kind:'refund_adjustment', amount_cents: −amount_refunded, status:'available' }`. Note: the
  handler treats every `charge.refunded` as a full refund (`fullyRefunded = true` is hardcoded; partial refunds are not
  distinguished on the booking).
- **default** — acknowledged (returns) so Stripe stops retrying unhandled types.

---

## 4. Two confirmation paths converge on the same idempotent write

A paid booking is confirmed by **whichever of two paths runs first**, both idempotent (`… where status='pending_payment'`):
1. **`/book/success`** (`confirmFromSession`, §8 of `12-booking-flow.md`) — retrieves the Checkout Session, checks
   `payment_status='paid'`, flips the booking to `confirmed`, upserts `payments`, unlocks messaging. Fast UX path.
2. **Webhook `payment_intent.succeeded`** — the durable, signature-verified source of truth; additionally writes the
   `earnings_ledger` earning row (the success page does **not**). If the browser never returns, the webhook still
   confirms.

Because both are gated on `status='pending_payment'`, running both converges to the same state.

---

## 5. Stripe Connect — professional payouts (`src/lib/payments/connect.ts` + `connect-actions.ts`)

Real integration path; requires a live Stripe account with Connect enabled. Payout eligibility is derived from
**Stripe's own flags**, never self-reported, and mirrored onto `professional_profiles`.

- `ensureConnectAccount(professionalId, email)` — reuses `professional_profiles.stripe_account_id` if present, else
  `stripe.accounts.create({ type:'express', capabilities:{ transfers, card_payments }, business_type:'individual' })`
  and stores the id (via **admin client**).
- `createOnboardingLink(accountId)` — `stripe.accountLinks.create({ type:'account_onboarding', refresh_url/return_url →
  /pro/payouts })`.
- `syncConnectStatus(professionalId)` — `stripe.accounts.retrieve(...)` → reads `details_submitted / charges_enabled /
  payouts_enabled`; `eligibleForPayout = payouts_enabled && !payouts_frozen`; mirrors onto
  `connect_details_submitted/charges_enabled/payouts_enabled/onboarded_at`.
- Actions (`connect-actions.ts`) are gated by `requirePro()` (live Supabase + Stripe configured + `role` ∈
  {professional, admin}): `startConnectOnboardingAction` (ensure account → onboarding url) and
  `refreshConnectStatusAction`.

Connect state columns added in `0009_launch_ops.sql`. **Note:** onboarding UI wiring — the professional onboarding page
itself is a stub (see `12-booking-flow.md` §11 / `11-auth-flow.md`), but these Connect server actions are real and can
be invoked from a `/pro/payouts` surface.

---

## 6. Earnings ledger & payout processing

`earnings_ledger` (`0009_launch_ops.sql`): `{ professional_id, booking_id, kind (earning|refund_adjustment|payout),
amount_cents (signed), status (pending|available|paid), available_at }`, **`unique(booking_id, kind)`** → idempotent
per booking+kind. RLS: owner or admin read. Populated by the webhook (§3): `+ (total − platform_fee)` on success,
`− amount_refunded` on refund.

**Payout processor** (`supabase/functions/payout-processor/index.ts`, Supabase Edge Function): finds `completed`
bookings with a `completed_at` and no existing `payout_records` row; skips pros with `payouts_frozen=true` (dispute/fraud
hold); computes `netCents = total_cents − platform_fee_cents`; inserts a `payout_records` row `status='pending'`
(idempotent per booking). **STUBBED:** the actual Stripe transfer is a `// TODO(stripe): create a Stripe transfer to
pro.stripe_account_id here.` — no money actually moves to the connected account yet.

---

## 7. Platform fee / split

- Commission is computed in the pricing engine (`src/lib/booking/pricing.ts`): `platformFeeCents =
  round((subtotal + travel − discount) * takeRateBps / 10000)`, excluding tax and tip. Stored on
  `bookings.platform_fee_cents` at creation. `takeRateBps` is hardcoded to **1500 (15%)** in `booking/actions.ts`
  (the `professional_profiles.take_rate_bps` column default is also 1500 but is **not read** by the booking action).
- The split is **not** applied at charge time today (no destination charge in the Checkout session, §2). Instead the
  net earning is recorded in `earnings_ledger` on payment success, and payouts are meant to transfer the net later
  (§6) — currently only recorded as `payout_records`, not transferred.

---

## 8. Money-flow step-by-step

1. Booking created → `bookings.status='pending_payment'`, with `amount_due_now_cents`, `total_cents`,
   `platform_fee_cents` snapshotted.
2. `createCheckoutSessionAction` reads `amount_due_now_cents` authoritatively → Stripe **hosted Checkout** for that
   amount (`bookingId` in session + PI metadata). **No Connect split** — funds go to the platform account.
3. Customer pays on Stripe's domain → redirected to `/book/success?session_id=…`.
4. `/book/success` verifies `payment_status='paid'` → idempotently confirms the booking + records `payments` +
   unlocks messaging.
5. Stripe fires `payment_intent.succeeded` → webhook (signature-verified, deduped via `stripe_events`) confirms the
   booking (if still pending), records `payments`, unlocks messaging, and writes `earnings_ledger` `earning` (pending)
   = `total − platform_fee`.
6. Professional completes Stripe Connect onboarding (`ensureConnectAccount` → `createOnboardingLink` →
   `syncConnectStatus` mirrors Stripe flags).
7. After the booking is `completed`, the **payout-processor** edge function creates a `payout_records` row for the net
   — **but the Stripe transfer itself is a TODO**, so the actual payout is not yet executed in code.
8. Refund → `charge.refunded` webhook sets `payments.status='refunded'` and writes a negative
   `refund_adjustment` (available) to `earnings_ledger`.

---

## 9. Test-mode vs live

- Nothing in the code branches on `sk_test_` vs `sk_live_` — behavior is identical; the mode is purely which
  `STRIPE_SECRET_KEY` / `STRIPE_WEBHOOK_SECRET` / `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` are set (`.env.example` shows
  both prefixes).
- **Two disabling layers:** (a) `isStripeConfigured()` — no `STRIPE_SECRET_KEY` → checkout/webhook/connect return
  friendly "not enabled" / 503; (b) `isLiveSupabase()` — placeholder Supabase URL → the whole flow is demo mode
  (`BookingFlow` shows "Demo mode — no payment was taken"; the webhook returns "no db").
- `src/lib/env.ts` `assertLaunchReady()` / `checkEnv()` require all Stripe keys (+ HTTPS `NEXT_PUBLIC_APP_URL`) for
  `staging`/`production`, but this is **not** enforced at import — it must be called from a health-check/deploy step.

---

## 10. Real vs stubbed — summary

**Real & wired:** Stripe hosted **Checkout** creation with server-authoritative amounts; the **webhook** with signature
verification, `stripe_events` exactly-once dedup, idempotent status-guarded confirmation, messaging unlock, and
`earnings_ledger` writes; `/book/success` idempotent confirmation; **Stripe Connect** Express account create/onboarding
link/status-sync (mirrored to `professional_profiles`); the earnings ledger schema + population; the payout-processor's
`payout_records` creation.

**Stubbed / incomplete:**
- **No Connect split at charge time** — the live Checkout session omits `application_fee_amount` / `transfer_data`
  (explicit code comment); all money currently lands on the platform account.
- **`createBookingPaymentIntent`** (the destination-charge path) is defined but **never called** — dead/reserved.
- **Payout transfer** — `payout-processor` records `payout_records` but the Stripe transfer is a `TODO`; no funds
  actually move to pros yet.
- `charge.refunded` treats every refund as full (partial-refund state on the booking is not modeled).
- Connect onboarding UI (`/onboarding/professional`, `/pro/payouts` trigger) is presentational; the server actions are
  real but need a wired surface to be reached.
