# iGlamHer — Implemented Features Audit

_Source of truth: actual code under `src/app`, `src/components`, `src/lib`, `supabase/`. Read, not inferred from docs._

## How to read "Status"

The app has a single data-source switch: **`isLiveSupabase()`** (`src/lib/data/source.ts`) returns `true` when `NEXT_PUBLIC_SUPABASE_URL` is set and does not contain `"placeholder"`. Every server data module and server action branches on it:

- **Live** → real Supabase (Postgres + RLS + service-role admin client). The same ranking / visibility / availability / pricing code runs on the returned rows.
- **Seed fallback** → deterministic in-memory data from `src/lib/data/seed.ts` (13 professional `userId`s / 18 slug rows) so the UI renders with no backend. Reads work; **all mutations are refused** with a "Connect the backend…" message.

`isLiveSupabase()` is referenced in **39 modules** (grep count). Current `.env.local` points at a **real Supabase project** and **Stripe test keys** (`sk_test` / `pk_test`), so locally the app runs in **Live-Supabase + Stripe-test** mode.

Status legend:
- **Live** — real DB/vendor path, works end-to-end when env is configured.
- **Partial** — works but with a documented gap (dormant vendor channel, un-wired split, etc.).
- **Seed/Mock-only** — no DB write path, or driven by the legacy `src/lib/mock-data.ts` layer.

Schema backing: `supabase/migrations/0001…0010` (11 migration files) cover schema, functions, RLS, marketplace, booking engine, trust & safety, jobs, growth, launch-ops, and mobile.

---

## Discovery & Search

| Feature | Description | Status |
|---|---|---|
| Discover / home feed | `/discover`, `/` — featured pros, category tiles, shelves, hero | Live (seed-fallback) |
| Professional search + ranking | `searchProfessionalViews()` loads active pros and re-ranks in TS (`marketplace/ranking.ts`); relevance/rating/distance/price sorts | Live (seed-fallback) |
| Natural-language search parse | `lib/search/parse.ts` turns free text into structured filters (category/price/location); flag `nl_search` on | Live |
| Semantic search (embeddings) | `integrations/search.ts` — OpenAI-embeddings provider selected only when `OPENAI_API_KEY` set; else keyword provider. Embeddings re-rank is an integration point, **not implemented** | Partial |
| Search suggest API | `/api/search/suggest` route with recent-search support (`lib/search/recent.ts`) | Live |
| Filters UI | `components/marketplace/Filters.tsx` — category, price min/max, location mode | Live |
| Geo / distance | `lib/data/geo.ts`; distance computed from viewer point (`DEFAULT_VIEWER`) — no live geolocation prompt wired | Partial |

> Scalability note in `data/professionals.ts`: live path loads up to 500 active pros and ranks in TS (fine at launch; FTS/PostGIS push-down is a documented later step).

## Categories

| Feature | Description | Status |
|---|---|---|
| Category listing | `listCategories()` from `categories` table, seed image fallback | Live (seed-fallback) |
| Category detail page | `/categories/[slug]` — pros filtered by category, with loading state | Live (seed-fallback) |

## Professional Profiles

| Feature | Description | Status |
|---|---|---|
| Public profile | `/professionals/[slug]` — bio, specialties, services, portfolio, reviews, availability preview, IG handle | Live (seed-fallback) |
| Service detail | `/services/[id]` — service + owning pro | Live (seed-fallback) |
| Public visibility gating | `marketplace/visibility.ts` — `isPubliclyVisible` / `publicServices` filter inactive/archived | Live |
| Portfolio (image/video/instagram) | Mapped from `professional_portfolio_items` | Live (seed-fallback) |
| Trust badges | `components/trust/TrustBadges.tsx`, `lib/trust/badges.ts` | Live |

## Booking

| Feature | Description | Status |
|---|---|---|
| Booking flow UI | `/book/[slug]`, `components/booking/BookingFlow.tsx` — service, add-ons, slot pick, tip, notes | Live (seed-fallback) |
| Availability calc | `lib/availability/calc.ts` — rules → open slots with buffers; unit-tested | Live |
| Server-authoritative pricing | `booking/pricing.ts` `computeBooking()` — price recomputed from stored service, never client; integer cents; unit-tested | Live |
| Atomic booking create | `createBookingDraftAction` → `create_booking()` RPC relying on exclusion constraint to reject double-books | Live (DB only) |
| Booking status machine | `booking/status.ts` `canTransition()` — guarded transitions; unit-tested | Live |
| Bookings list | `/bookings`, `/account` | Live (DB only) |
| Bookings pause kill-switch | `isBookingsPaused()` blocks new drafts w/o redeploy | Live |
| Legacy static booking screen | `/booking?stylist=` still imports `lib/mock-data.getStylist` (Phase-1 summary screen) | **Seed/Mock-only** |
| Booking reminders (24h/2h) | `supabase/functions/booking-reminders` edge fn writes in-app notifications | Live (push TODO) |

## Payments / Stripe

| Feature | Description | Status |
|---|---|---|
| Checkout (deposit/total) | `payments/actions.ts` — hosted Stripe Checkout, amount read from persisted booking, `/book/success` confirm | Live (Stripe test) |
| Webhook (source of truth) | `/api/stripe/webhook` — signature-verified, exactly-once via `stripe_events`, idempotent upserts; handles `payment_intent.succeeded/failed/canceled`, `charge.refunded`; unlocks conversation, writes earnings ledger | Live |
| Destination-charge split to pro | **Not wired** — deposit captured to platform, reconciled on payout (noted in code) | Partial |
| Stripe Connect onboarding | `payments/connect.ts` — Express account create, hosted onboarding link, true status synced from Stripe (`charges_enabled`/`payouts_enabled`) | Live |
| Payout processing | `supabase/functions/payout-processor` creates `payout_records` (idempotent, skips frozen); **Stripe transfer itself is a TODO** | Partial |
| Payments pause kill-switch | `isPaymentsPaused()` | Live |
| Refunds | Handled in webhook → `payments.status=refunded` + negative earnings adjustment | Live |

## Messaging

| Feature | Description | Status |
|---|---|---|
| Conversations / messages | `/messages`, `messaging/actions.ts` — send via server action, RLS membership | Live (DB only) |
| Pre-payment contact-info guard | `messaging/contact-guard.ts` — blocks phone/email/handles until conversation unlocked; blocked attempts logged redacted+flagged; unit-tested | Live |
| Unlock on payment | Webhook sets `conversations.is_unlocked=true` after payment succeeds | Live |
| Realtime messaging | **No Supabase realtime/channel subscriptions found** — page is request/revalidate based, not live | Partial |
| Voice calling | Flag `voice_calling` default **off** ("needs provider") — not built | Not built |

## Reviews & Ratings

| Feature | Description | Status |
|---|---|---|
| Review display | `ReviewCard`, `RatingBreakdown`, mapped from `reviews` table (author shown as "Verified client") | Live (seed-fallback) |
| Rating aggregation | `reviews/aggregate.ts` — averages + distribution; unit-tested | Live |
| Review submission flow | No customer-facing "write review" server action found in `src/lib` (reviews are read/aggregated; write path appears DB/seed-driven only) | Partial |

## Favorites

| Feature | Description | Status |
|---|---|---|
| Favorite toggle | `marketplace/favorites-actions.ts`, `FavoriteButton`, optimistic provider (`lib/favorites/provider.tsx`) | Live (DB only) |
| Favorites page | `/account/favorites` with loading state, batch fetch (`getProfessionalsByUserIds`, N+1-avoiding) | Live (seed-fallback for pros) |

## Notifications (push / in-app)

| Feature | Description | Status |
|---|---|---|
| In-app notifications | `integrations/notifications.ts` `sendInApp` writes `notifications` table; `NotificationBell`, `NotificationList`, `/notifications` | Live (DB) |
| Unified dispatch service | `dispatchNotification()` — pluggable channels, always writes in-app | Live |
| Email (Resend) | Env-gated; when configured logs `email.pending` — **actual send is an integration point, not enabled** | Partial (dormant) |
| SMS (Twilio) | Same pattern — wired, send not enabled | Partial (dormant) |
| Push (APNs/FCM) | Looks up `device_tokens`, logs `push.pending`; **fan-out to APNs/FCM not implemented** | Partial (dormant) |
| Device token registration | `native/push-actions.ts` — upsert/remove `device_tokens` for ios/android/web | Live (DB) |

## Loyalty / Rewards / Referrals

| Feature | Description | Status |
|---|---|---|
| Loyalty points & tiers | `loyalty/engine.ts` (pure, tested), `loyalty/award.ts`, `loyalty/data.ts`, `/account/rewards`, `RewardsPanel` | Live (DB) |
| Points on booking | `awardBookingPoints()` called from booking actions | Live (DB) |
| Referrals | `referral/engine.ts` + `referral/actions.ts` + `referral/data.ts` — codes & rewards; flag `referrals` on | Live (DB) |
| Rewards flags | `loyalty`, `referrals`, `campaigns` default on in `lib/flags` | Live |

## Professional Dashboard

| Feature | Description | Status |
|---|---|---|
| Pro shell / context | `components/pro/ProShell.tsx`, `lib/pro/context.ts` | Live |
| Profile edit | `/pro/profile`, `ProfileForm`, `pro/actions.ts`, Zod schemas | Live (DB) |
| Services CRUD | `/pro/services`, `/new`, `/[id]/edit`, `ServiceForm`, `ServiceRowActions` | Live (DB) |
| Availability editor | `/pro/availability`, `AvailabilityEditor` | Live (DB) |
| Portfolio manager | `PortfolioManager` (reorder, cover, hide) | Live (DB) |
| Earnings | `/pro/earnings`, `growth/provider-metrics.ts` — gross/net/fees, weekly trend, forecast, utilization, repeat-rate, optimization tips (pure, tested) | Live (DB) |
| Connect payouts | `/pro/payouts` (referenced), `ConnectPayouts` component, connect actions | Live |
| Avatar upload | `account/avatar-actions.ts`, `AvatarUpload` → Supabase storage (`storage/documents.ts` gated on live) | Live (DB) |

## Admin

| Feature | Description | Status |
|---|---|---|
| Admin gate | `admin/require-admin-page.ts` + per-action `requireAdmin()` (role check via service-role client) | Live |
| Admin dashboard | `/admin` — integration status panel (`integrations/config.ts`) | Live |
| Analytics | `/admin/analytics`, `analytics/metrics.ts` + `analytics/data.ts` — booking facts, funnels | Live (DB) |
| Campaigns / discounts | `/admin/campaigns`, `CampaignManager`, `marketing/*` | Live (DB) |
| Trust & safety actions | `admin/trust-actions.ts` — verification decisions, dispute resolution, content reports, account/payout **freeze (never delete)**, all audit-logged | Live (DB) |
| Identity verification | `integrations/identity.ts` — Persona / Stripe Identity providers env-gated; returns "not_configured" when absent, **never a fake verified**. Session-create bodies are integration points (return null url) | Partial (stub sessions) |
| Fraud signals | `trust/fraud.ts` + `integrations/fraud-signals.ts` — rule-based scoring (e.g. "possible fake reviews"); FingerprintJS env-gated | Live (rules) / Partial (vendor) |
| Moderation | `moderation/actions.ts` — content reports w/ reason enum | Live (DB) |
| Ops kill-switches | `ops/settings.ts` — maintenance mode, bookings/payments pause, beta gating from `platform_settings` (cached 15s, safe-default ON) | Live (DB) |
| Audit log | `audit/log.ts` `writeAudit()` | Live (DB) |

## Auth

| Feature | Description | Status |
|---|---|---|
| Email/password sign in/up | `/signin`, `/signup`, `auth/actions.ts`, `auth/schemas.ts` (Zod) | Live |
| OAuth (Google) | `OAuthButtons`, configured in Supabase dashboard | Live |
| Password reset | `/(auth)/forgot-password`, `/reset-password` | Live |
| Auth callback | `/auth/callback` route | Live |
| Safe redirect | `auth/safe-next.ts` — open-redirect guard; unit-tested | Live |
| Middleware session | `src/middleware.ts` — refreshes session; **no-ops when Supabase is placeholder** | Live |
| Onboarding | `/onboarding/customer`, `/onboarding/professional` | Live |

## PWA / Native (Capacitor, offline)

| Feature | Description | Status |
|---|---|---|
| Service worker | `public/sw.js`; registered in prod by `PWARegister` (no-op in dev) | Live |
| Web manifest | `src/app/manifest.webmanifest` | Live |
| Offline page | `/offline` | Live |
| Pull-to-refresh | `ui/PullToRefresh.tsx` (touch only) | Live |
| Deep-link association files | `/api/wellknown/aasa` (Apple) + `/api/wellknown/assetlinks` (Android) | Live |
| Capacitor config | `capacitor.config.ts` present (`com.iglamher.app`) | Partial |
| Native iOS/Android projects | **Not generated** — `webDir: public`, `server.url` commented out, no `ios/` or `android/` folders. `npx cap add ios/android` not run | **Not built** |
| Native plugins (biometrics, camera, Apple/Google Pay) | Described in config/docs; not present in codebase | **Not built** |

## Recommendations Engine

| Feature | Description | Status |
|---|---|---|
| Recommendation shelves | `recommend/shelves.ts` — recommended / trending / top_rated / new / available_today / luxury; unit-tested | Live |
| Recommendation engine | `recommend/engine.ts` + `recommend/data.ts` (`getShelf`); flag `ai_recommendations` on | Live (rules, seed-fallback) |
| Recommendations API | `/api/recommendations?shelf=&limit=` — rate-limited, validated | Live |
| "AI" personalization | Rule/scoring based (not an LLM/embeddings model) | Live |

## Cross-cutting infrastructure

| Feature | Description | Status |
|---|---|---|
| Rate limiting | `security/rate-limit.ts` — Redis (Upstash) when `REDIS_URL` set, per-instance fallback otherwise; tested | Live/Partial |
| Cache | `cache/index.ts` + `cache/redis.ts` | Live |
| Feature flags | `lib/flags` — config defaults + `FLAG_*` env overrides + deterministic canary buckets; tested | Live |
| Observability | `observability/logger.ts` `captureError`/`log`; Sentry env-gated (recommended, not required) | Partial |
| Env validation | `lib/env.ts` — Zod public/server schemas + `assertLaunchReady()` / `checkEnv()` (NOT run at import) | Live |
| Analytics client | `lib/analytics.ts` — **console-only placeholder sink**; "replace with real client SDK (PostHog/GA)" | Partial |
| Privacy blocks | `privacy/blocks.ts` — block-list logic; tested | Live |

---

## Testing footprint

| Kind | Count | Location |
|---|---|---|
| Vitest unit test files | **17** | `src/lib/**/__tests__/*.test.ts` + `src/lib/__tests__/*` |
| Vitest test cases (`it`/`test`) | **~149** | across the 17 files |
| Playwright e2e specs | **4** (+ README) | `e2e/auth.spec.ts`, `booking.spec.ts`, `marketplace.spec.ts`, `pro-services.spec.ts` |
| Playwright test cases | **~29** | across the 4 specs |

Tested domains (pure logic, well covered): availability calc, booking pricing & status, review aggregate, marketplace ranking, recommend engine & shelves, loyalty/referral/trust "phase7-engines", "phase8-infra", messaging contact-guard, search parse, security rate-limit, auth safe-next, privacy blocks, env, format.

Scripts: `db:seed`, `verify:live`, `db:health` (`scripts/`), plus `lint`, `typecheck`, `test`, `test:e2e`.

---

## Summary of what is genuinely production-real vs. dormant

- **Real end-to-end (with live env):** auth, professional profiles, services/availability/portfolio CRUD, booking create + pricing + status, Stripe Checkout + webhook reconciliation + earnings ledger, Stripe Connect onboarding/status, favorites, loyalty/referrals, in-app notifications, admin trust/safety + ops kill-switches, recommendations, search/ranking.
- **Wired but dormant until keys/code enabled:** email (Resend), SMS (Twilio), push send (APNs/FCM), semantic search embeddings (OpenAI), identity verification (Persona/Stripe Identity), fraud device-fingerprint (FingerprintJS), Sentry, real analytics sink.
- **Not built:** native iOS/Android shells, native-only plugins, in-app voice calling, destination-charge payment split, actual Stripe payout transfers.
- **Legacy mock remnant:** `/booking` page still uses `lib/mock-data.ts`.
