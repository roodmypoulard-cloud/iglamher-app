# iGlamHer — Route Analysis

Next.js 16 App Router + TypeScript. All routes live under `src/app`. This document enumerates every page and route handler, its rendering mode, auth requirement, and purpose.

## Legend

- **Rendering** — `○ Static` (prerendered, no request-time data) · `ƒ Dynamic` (rendered per-request). Inferred from `export const dynamic`, use of `await params`/`await searchParams`, `cookies()`, or Supabase auth calls.
- **Auth** — `Public` · `Sign-in` (requires an authenticated user) · `Pro` (requires a professional account) · `Admin` (requires `role = admin`).
- Auth is enforced at two layers:
  - **Middleware** (`src/middleware.ts`) redirects unauthenticated users away from `/bookings`, `/messages`, `/profile`, `/onboarding*` and redirects signed-in users away from `/signin`, `/signup`.
  - **Page-level guards** — `getProContext()` (`redirect("/signin?next=…")` if `!authed`), `requireAdminPage()` (redirect if not admin), or inline `supabase.auth.getUser()` checks.
- **Fail-open behavior:** most guards only enforce when `isLiveSupabase()` is true. Without a live Supabase (local/demo), pro & admin pages render a demo account and favorites/rewards skip the auth check.

---

## Public / Marketing

| Path | Rendering | Auth | Purpose |
|------|-----------|------|---------|
| `/` | ○ Static | Public | Landing page — full-bleed brand hero, "Get started" → `/discover`, sign-in link. |
| `/about` | ○ Static | Public | About iGlamHer (rendered via `LegalLayout`). |
| `/how-it-works` | ○ Static | Public | Customer & professional how-it-works steps. |
| `/legal/privacy` | ○ Static | Public | Privacy Policy (counsel-review template). |
| `/legal/terms` | ○ Static | Public | Terms of Service (counsel-review template). |
| `/legal/cancellation` | ○ Static | Public | Cancellation Policy. |
| `/offline` | ○ Static | Public | PWA offline fallback screen. |
| `/not-found` (`not-found.tsx`) | ○ Static | Public | 404 page. |
| `error.tsx` | ƒ Client | Public | Root client error boundary (`"use client"`) with reset. |

> Note: `src/app/(marketing)/` route group directory exists but is currently **empty** (no routes).

## Auth

Route group `(auth)` wraps password-recovery pages (no shared layout file — the group is organizational only). `/signin` & `/signup` sit at the app root, not inside the group.

| Path | Route group | Rendering | Auth | Purpose |
|------|-------------|-----------|------|---------|
| `/signin` | — | ƒ Dynamic (`await searchParams` for `next`) | Public (middleware bounces signed-in users to `/discover`) | Email/password sign-in + OAuth (Google/Apple), honors `?next=`. |
| `/signup` | — | ○ Static | Public (middleware bounces signed-in users) | Account creation form + OAuth buttons. |
| `/forgot-password` | `(auth)` | ○ Static | Public | Request a password-reset email. |
| `/reset-password` | `(auth)` | ○ Static | Public | Choose a new password (after email link). |
| `/auth/callback` | — | ƒ Route handler (GET) | Public | Supabase code exchange for email verify / password reset / OAuth; redirects to `safeNext(next)` or `/signin?error=auth_callback`. |
| `/onboarding/customer` | — | ○ Static | Sign-in (middleware-gated) | Customer onboarding form (name/phone/city/notification prefs). |
| `/onboarding/professional` | — | ○ Static | Sign-in (middleware-gated) | Multi-step pro onboarding progress UI (11 steps). |

## Customer — Discover / Search / Booking / Account

| Path | Rendering | Auth | Purpose |
|------|-----------|------|---------|
| `/discover` | ƒ Dynamic (`force-dynamic`) | Public | Home feed — categories, "Recommended for you", "Popular near you"; loads categories, ranked pros, favorites, recommendations. |
| `/search` | ƒ Dynamic (`force-dynamic`) | Public | Search results w/ filters, sort, natural-language query parsing; `Suspense`-wrapped results. |
| `/categories/[slug]` | ƒ Dynamic (`force-dynamic`) | Public | Category landing (hair/makeup/lashes/nails/stylist) with pros grid + sort; `notFound()` for invalid slugs. |
| `/professionals/[slug]` | ƒ Dynamic (`force-dynamic`) | Public | Professional profile — hero, trust badges, services, portfolio, availability preview, reviews, sticky booking CTA. Has `generateMetadata`. |
| `/services/[id]` | ƒ Dynamic (`force-dynamic`) | Public | Single service detail + add-ons + link back to the pro. |
| `/book/[slug]` | ƒ Dynamic (`force-dynamic`) | Public* | Interactive booking flow (slot picker + pricing + Stripe checkout draft); `?service=` pre-selects. *Payment/booking actions require auth server-side. |
| `/book/success` | ƒ Dynamic (`force-dynamic`) | Public (Stripe session = proof of payment) | Confirms a paid booking from a Stripe `session_id` via admin client; no browser auth (survives cross-site return). |
| `/booking` | ƒ Dynamic (`await searchParams`) | Public | Legacy Phase-1 static booking summary (mock data via `?stylist=`). |
| `/bookings` | ○ Static | Sign-in (middleware-gated) | Placeholder "Your bookings" screen (empty state). |
| `/messages` | ○ Static | Sign-in (middleware-gated) | Placeholder "Messages" screen (chat unlocks after booking). |
| `/notifications` | ○ Static | Public | Notifications list (client store `NotificationList`). |
| `/account` | ƒ Dynamic (`force-dynamic`) | Sign-in (loads customer bookings) | Account hub — upcoming bookings + quick links (favorites, rewards, notifications, messages, settings). |
| `/account/favorites` | ƒ Dynamic (`force-dynamic`) | Sign-in (inline guard when live) | Saved professionals (client `localStorage` store drives which are shown). |
| `/account/rewards` | ƒ Dynamic (`force-dynamic`) | Sign-in (inline guard when live) | iGlam Rewards — tier/points balance, redeem, referral; empty state without live backend. |
| `/profile` | ƒ Dynamic (`cookies()` via Supabase) | Sign-in (middleware-gated) | Customer profile/settings — avatar upload, addresses, prefs, sign-out. |

## Professional — `/pro/*`

All pro pages call `getProContext()` and `redirect("/signin?next=…")` when `!ctx.authed` (live DB only); in demo mode they render `PROFESSIONALS[0]`. All are `export const dynamic = "force-dynamic"`.

| Path | Rendering | Auth | Purpose |
|------|-----------|------|---------|
| `/pro/profile` | ƒ Dynamic | Pro | Public profile editor + portfolio manager + completeness meter. |
| `/pro/availability` | ƒ Dynamic | Pro | Weekly hours / booking-notice / max-window editor (UTC-stored). |
| `/pro/earnings` | ƒ Dynamic | Pro | Earnings dashboard — weekly net, payout overview, Stripe Connect onboarding. |
| `/pro/services` | ƒ Dynamic | Pro | Services list (active + archived) with row actions. |
| `/pro/services/new` | ƒ Dynamic | Pro | Create a new service. |
| `/pro/services/[id]/edit` | ƒ Dynamic | Pro | Edit an existing service; `notFound()` if not owned. |

## Admin — `/admin/*`

All admin pages call `requireAdminPage(path)` → redirect to `/signin` if unauth, `/discover` if `role !== "admin"` (live DB only; demo mode renders with an "isDemo" banner). All `force-dynamic`.

| Path | Rendering | Auth | Purpose |
|------|-----------|------|---------|
| `/admin` | ƒ Dynamic | Admin | Command center — platform overview, verification queue, open reports/disputes, pro moderation rows, integration status. |
| `/admin/analytics` | ƒ Dynamic | Admin | Marketplace KPIs — GMV, funnel, retention, daily GMV chart. |
| `/admin/campaigns` | ƒ Dynamic | Admin | Marketing campaigns manager — coupons, promos, geo-targeted offers. |

## API — `/api/*` (Route Handlers)

| Path | Method | Rendering | Auth | Purpose |
|------|--------|-----------|------|---------|
| `/api/health` | GET | ƒ Dynamic (`force-dynamic`, `no-store`) | Public | Liveness + readiness (DB/payments/integrations configured); no secrets leaked. |
| `/api/recommendations` | GET | ƒ Dynamic (`force-dynamic`) | Public (IP rate-limited) | Recommendation shelves (`?shelf=&limit=`); validates shelf key. |
| `/api/search/suggest` | GET | ƒ Dynamic (`force-dynamic`) | Public (IP rate-limited) | Autocomplete + popular searches; 60s-cached corpus. |
| `/api/stripe/webhook` | POST | ƒ Route handler | Public (Stripe-signature-verified) | Source of truth for payment state — signature-verified, exactly-once via `stripe_events`, idempotent side effects. |
| `/api/wellknown/aasa` | GET | ○ Static (`force-static`) | Public | Apple Universal Links association (rewritten to `/.well-known/apple-app-site-association`). |
| `/api/wellknown/assetlinks` | GET | ○ Static (`force-static`) | Public | Android App Links association (rewritten to `/.well-known/assetlinks.json`). |

## Well-known / PWA

- **App Links / Universal Links** — served by the two `/api/wellknown/*` static handlers above; `next.config` rewrites `/.well-known/*` to them.
- **Manifest** — `manifest: "/manifest.webmanifest"` declared in `src/app/layout.tsx` metadata (static file in `public/`).
- **Service worker** — registered client-side by `PWARegister` (mounted in `AppProviders`); `/offline` is the offline fallback route.
- **iOS web-app** — `appleWebApp` metadata (capable, black-translucent status bar) + `themeColor #0B0909` viewport.

## Special files (not routes)

| File | Purpose |
|------|---------|
| `src/app/layout.tsx` | Root layout — Cormorant Garamond + Inter fonts, global metadata/viewport, wraps children in `AppProviders`. |
| `src/app/template.tsx` | Per-navigation re-mount wrapper adding the `page-enter` transition animation. |
| `src/app/globals.css` | Global styles / design tokens. |
| `*/loading.tsx` | Route-segment loading skeletons for `discover`, `search` (none listed), `categories/[slug]`, `services/[id]`, `account/favorites`. |

**Loading files present:** `account/favorites/loading.tsx`, `categories/[slug]/loading.tsx`, `discover/loading.tsx`, `search/loading.tsx`, `services/[id]/loading.tsx`.
