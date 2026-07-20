# iGlamHer — Anonymous (Logged-Out) Access Audit & Matrix

**Date:** 2026-07-20
**Question:** every page/action reachable without authentication, and whether any protected action was exposed.

## Summary

Three layers enforce access: **middleware** (redirects anon before render), **per-page guards** (redirect in the server component), and **RLS + server-action auth** (the real data enforcement — anon reads return 0 rows, mutations are rejected). The data layer was already solid (verified live: anon reads of `bookings/messages/payments/loyalty/profiles` all return `[]`; booking action returns *"Please sign in to book."*; `sendMessageAction` requires auth). **The gaps were page-render only** — a few authenticated *dashboard shells* rendered for anon (no private data leaked, but they should not be reachable). Those are now fixed.

### Gaps found & fixed (this change)

| Route | Was | Now | Fix |
|---|---|---|---|
| `/book/[slug]` (booking flow) | rendered for anon (booking *creation* already blocked by the action) | redirect → `/signin` | middleware `/book` |
| `/booking` (stale Phase-1 mock) | rendered for anon (mock data only) | redirect → `/signin` | middleware `/book` |
| `/book/success` | rendered for anon | redirect → `/signin` | middleware `/book` |
| `/account` (customer dashboard) | **rendered shell for anon** | redirect → `/signin?next=/account` | middleware `/account` + page guard |
| `/notifications` | **rendered shell for anon** | redirect → `/signin?next=/notifications` | middleware `/notifications` + page guard |
| `/pro/*` (provider dashboard) | per-page guard only | + middleware `/pro/` | defense-in-depth |
| `/admin/*` | per-page guard only (role) | + middleware `/admin` (auth) | defense-in-depth (role still enforced in `requireAdminPage`) |

No route allowed anonymous booking creation, message sending, or private-data reads — those are blocked at the action/RLS layer and were never exposed. The fix closes the *page-visibility* gaps and adds middleware as a uniform first line.

---

## PUBLIC (no authentication required)

| Route | Purpose |
|---|---|
| `/` | Landing page |
| `/discover` | Browse marketplace |
| `/search` | Search providers |
| `/categories/[slug]` | Category browse |
| `/professionals/[slug]` | Provider profile (public) |
| `/services/[id]` | Service detail |
| `/about`, `/how-it-works` | Marketing |
| `/legal/privacy`, `/legal/terms`, `/legal/cancellation` | Legal |
| `/signin`, `/signup`, `/forgot-password`, `/reset-password` | Auth entry |
| `/offline` | PWA offline fallback |
| **API** `/api/health` | Liveness (no private data) |
| **API** `/api/recommendations`, `/api/search/suggest` | Public browse data (rate-limited, RLS-scoped) |
| **API** `/api/stripe/webhook` | Stripe → server (HMAC signature-verified, not a browser route) |
| **API** `/api/wellknown/aasa`, `/api/wellknown/assetlinks` | App-association files (must be public) |

Provider profiles, services, and reviews are public **read-only** — reviews render on the public profile; there is no standalone anonymous review-write path (writing a review requires a completed booking, enforced by trigger `P0001`).

## AUTHENTICATION REQUIRED

| Route | Area | Guard |
|---|---|---|
| `/book/[slug]`, `/book/success`, `/booking` | Booking | middleware `/book` + action `auth.getUser()` |
| `/bookings` | Customer bookings | middleware + RLS |
| `/messages`, `/messages/[id]` | Messaging | middleware + `sendMessageAction` auth + RLS |
| `/account`, `/account/favorites`, `/account/rewards` | Customer dashboard / favorites / rewards | middleware + page guard + RLS |
| `/notifications` | Notifications | middleware + page guard + RLS |
| `/profile` | Profile editing | middleware + RLS |
| `/onboarding/customer`, `/onboarding/professional` | Onboarding | middleware + action auth |
| `/pro/profile`, `/pro/services`, `/pro/services/new`, `/pro/services/[id]/edit`, `/pro/availability`, `/pro/earnings` | Provider dashboard | middleware `/pro/` + `getProContext` guard + RLS |
| `/admin`, `/admin/analytics`, `/admin/campaigns` | Admin dashboard | middleware `/admin` (auth) + `requireAdminPage` (role=admin) + RLS |

**Payments:** no anonymous payment path exists — checkout is created inside the authenticated booking action; the Stripe webhook is signature-verified.

---

## Access matrix (middleware classification — verified: 0 misclassified against all 36 routes)

```
PUBLIC                          AUTH-REQUIRED
/                               /book/[slug]
/discover                       /book/success
/search                         /booking
/categories/[slug]              /bookings
/professionals/[slug]           /messages , /messages/[id]
/services/[id]                  /account , /account/favorites , /account/rewards
/about , /how-it-works          /notifications
/legal/*                        /profile
/signin , /signup               /onboarding/customer , /onboarding/professional
/forgot-password                /pro/*  (provider dashboard)
/reset-password                 /admin/*  (admin dashboard — also role-gated)
/offline
/api/health
/api/recommendations
/api/search/suggest
/api/stripe/webhook  (HMAC)
/api/wellknown/*
```

**Anonymous users cannot:** create bookings (action rejects), send messages (action + RLS reject), open any dashboard (middleware redirect), or read private user data (RLS returns 0 rows — verified live). Middleware now redirects anon to `/signin?next=<path>` before any authenticated page renders; per-page guards and RLS remain as backstops.

**Verification:** `tsc --noEmit` ✅, `eslint` ✅, `next build` ✅; middleware prefix classification tested against all 36 routes → 0 public routes protected, 0 private routes public. Live data-layer denial (anon RLS 0-rows, booking/message action rejection) confirmed against production in prior phases.
