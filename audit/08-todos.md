# iGlamHer — Unfinished Work & TODO Audit

_Grep-driven inventory of `TODO / FIXME / HACK / XXX / mock / not implemented / coming soon / placeholder / stub / no-op / simulate / fake / @ts-ignore / @ts-expect-error / fail-open`, plus a reading-based "Known incomplete areas" section. Scope: `src/**` and `supabase/functions/**` (excludes tests)._

## Explicit code markers

### TODO / integration-point stubs (functional gaps)

| File:line | Marker | Note |
|---|---|---|
| `supabase/functions/booking-reminders/index.ts:43` | `TODO(push)` | Reminder writes in-app notification only; APNs/FCM dispatch not implemented ("once device tokens + certs exist"). |
| `supabase/functions/payout-processor/index.ts:37` | `TODO(stripe)` | Creates `payout_records` but the actual **Stripe transfer to the pro's connected account is not implemented**. |
| `src/lib/integrations/notifications.ts:48-52` | integration point | Email (Resend) send is commented; returns `delivered:false, "resend wired; enable send in code"`. |
| `src/lib/integrations/notifications.ts:57-59` | integration point | SMS (Twilio) send not implemented; returns `"twilio wired; enable send in code"`. |
| `src/lib/integrations/notifications.ts:74-78` | integration point | Push fan-out to APNs/FCM not implemented; only logs `push.pending`. |
| `src/lib/integrations/search.ts:18-24` | integration point | `OpenAIEmbeddingsProvider` still just runs the keyword parser — embeddings/pgvector re-rank not implemented. |
| `src/lib/integrations/identity.ts:22-35` | stub sessions | Persona and Stripe Identity `createSession()` return `{ sessionId:null, url:null }` — no real hosted verification URL created. |
| `src/lib/payments/actions.ts:35-37` | NOTE | Destination-charge split to the stylist's connected account **not wired**; deposit captured to platform, reconciled later. |

### Placeholder / "not configured" sinks

| File:line | Marker | Note |
|---|---|---|
| `src/lib/analytics.ts:34` | `Placeholder sink` | Client analytics only `console.debug`s — "Replace with real client SDK call" (PostHog/GA). |
| `src/components/pro/ServiceForm.tsx:141` | `Placeholder until payments phase` | Deposit % field hint says it's a placeholder pending the payments phase. |
| `src/lib/env.ts:43,74,75` | `isPlaceholder` | Launch-readiness check treats any value containing `"placeholder"` as missing. |
| `src/lib/data/source.ts:9` | placeholder check | Data-source switch: URL containing `"placeholder"` ⇒ seed mode. |
| `src/lib/integrations/config.ts:31` | placeholder check | Supabase counted "configured" only if URL set and not `"placeholder"`. |

### No-op / degraded-mode behavior (by design, but incomplete surfaces)

| File:line | Marker | Note |
|---|---|---|
| `src/middleware.ts:12-13` | fail-open | If Supabase URL/anon missing or `placeholder`, middleware **returns without blocking anything** (pre-Phase-2 escape hatch). |
| `src/components/PWARegister.tsx:4` | No-op in dev | Service worker only registers in production. |
| `src/components/ui/PullToRefresh.tsx:10` | No-op | No-op with a mouse; touch devices only. |
| `src/lib/storage/documents.ts:55` | not configured | Returns `{ok:false,"Storage not configured."}` when not live Supabase. |

### `@ts-ignore` / `@ts-expect-error`

None found in `src/**` (grep clean). TypeScript is strict; live-Supabase rows are handled with explicit `as unknown as RowType` casts in the data layer rather than ignore directives.

### "mock" / "fake" / "dummy" references

| File:line | Note |
|---|---|
| `src/lib/mock-data.ts` (whole file) | Legacy Phase-1 seed (`STYLISTS`, `CATEGORIES`). Header says "Never used in production paths." |
| `src/app/booking/page.tsx:4` | **Only remaining importer of `mock-data`** — legacy static booking summary screen still runs on mock `getStylist()`. |
| `src/lib/trust/fraud.ts:44` | Legit rule ("Possible **fake** reviews") — heuristic, not a stub. |
| `src/lib/moderation/actions.ts:13` | `fake_profile` is a report-reason enum value — not a stub. |

_Note: the vast majority of "placeholder" grep hits are HTML input `placeholder=` attributes and the `SmartImage`/`Avatar` blur-placeholder UI — cosmetic, not incomplete work._

---

## Known incomplete areas (from reading the code)

### 1. Mobile / native — not built
- No `ios/` or `android/` native projects. `capacitor.config.ts` uses `webDir: "public"` with `server.url` **commented out**; `npx cap add ios/android` has not been run.
- Native-only plugins named in config/docs (biometrics, camera, Apple/Google Pay, maps) are **not present in code**.
- iOS/Android push certs/tokens: registration table (`device_tokens`) exists and `native/push-actions.ts` writes to it, but nothing sends to APNs/FCM (see TODOs above).

### 2. Vendor channels wired but dormant (no send happens until code + keys added)
- **Email (Resend), SMS (Twilio), Push (APNs/FCM)** — all env-gated in `integrations/notifications.ts`; only in-app notifications actually deliver today.
- **Semantic search (OpenAI embeddings)** — provider selected by `OPENAI_API_KEY` but only runs keyword parse; no vector store / re-rank.
- **Identity verification (Persona / Stripe Identity)** — abstraction exists; `createSession()` returns null URLs, so no real KYC flow. Admin can still manually approve/reject verifications via `trust-actions.ts`.
- **Fraud device fingerprint (FingerprintJS)** — env-gated; only rule-based fraud scoring runs.
- **Sentry** and **real client analytics** — recommended/optional; not enabled (`analytics.ts` is console-only).

### 3. Payments — partial
- **No destination-charge split**: customer deposit is captured to the platform, not split to the pro's Connect account at checkout (`payments/actions.ts` NOTE).
- **No real payout transfer**: `payout-processor` edge fn records `payout_records` but never calls `stripe.transfers.create` (TODO). Payout money movement is therefore not automated.
- Currently on **Stripe test keys** (`sk_test`/`pk_test`) in `.env.local`.

### 4. Messaging — no realtime
- No Supabase realtime / `.channel()` / `postgres_changes` subscriptions anywhere in `src/**`. `/messages` and `/notifications` rely on request/revalidate, not live updates.
- **Voice calling** flag (`voice_calling`) is default **off** ("needs provider") — feature not implemented.

### 5. Reviews — write path thin
- Reviews are read and aggregated (`reviews/aggregate.ts`), and mapped from the DB, but there is **no customer-facing "leave a review" server action** in `src/lib`. Review creation appears to depend on seed/DB rows rather than an in-app flow.

### 6. Seed-mode limitations (fail-open / degraded)
- When `isLiveSupabase()` is false, **all reads fall back to `src/lib/data/seed.ts`** (13 pros) and **every mutation is refused** with a "Connect the backend…" message. This is intentional but means the seed build is browse-only.
- `middleware.ts` **fails open** (no auth gating) under placeholder Supabase config — safe for local, but worth confirming production never runs with a placeholder URL. `assertLaunchReady()` exists to catch this but is **not called at import time** (must be invoked from a health/deploy step).
- `ops/settings.ts` defaults **everything ON** (bookings/payments enabled) when the backend isn't connected — safe-default, but another fail-open path to be aware of.

### 7. Flags defaulting features on without full backing
- `ai_recommendations`, `recommendation_shelves`, `nl_search` are **on by default** but are rule/keyword based, not ML — fine, just not "AI" in the model sense.
- `live_presence` flag exists with `rollout: 0` (effectively off, no implementation).

### 8. Geolocation
- Distance uses a fixed `DEFAULT_VIEWER` point; no browser geolocation permission flow wired for the marketplace viewer.

---

## Quick priority read (for a real launch)

| Priority | Item |
|---|---|
| P0 | Wire real Stripe **payout transfers** + payout schedule (money owed to pros is not moving). |
| P0 | Enable at least **one** transactional channel (email via Resend) for booking confirmations/reminders. |
| P1 | Enable **push send** (APNs/FCM) — plumbing + token storage already exist. |
| P1 | Decide on **destination-charge split** vs. platform-capture + payout model. |
| P1 | Add a customer **"write a review"** flow. |
| P2 | Generate native **iOS/Android** projects if shipping to stores. |
| P2 | Replace **console analytics** sink with a real provider; enable **Sentry**. |
| P2 | Remove/replace the legacy **`/booking` mock page**. |
| P3 | Realtime messaging; identity verification vendor; semantic-search embeddings. |
