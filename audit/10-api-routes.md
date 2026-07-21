# iGlamHer — API Routes & Server Actions Audit

Two distinct surfaces: (1) a small set of REST route handlers under `src/app/api/**/route.ts`, and (2) the app's real mutation surface — Next.js **server actions** (`"use server"`) under `src/lib/**`. Server actions are the primary write path; REST is used for the Stripe webhook, health, discovery/search, and native app-link association files.

---

## Part 1 — REST Route Handlers (`src/app/api/**/route.ts`)

### 1.1 `GET /api/health` — `src/app/api/health/route.ts`
- **Method:** GET (`dynamic = "force-dynamic"`).
- **Purpose:** Liveness + configuration readiness for a load balancer / uptime monitor.
- **Auth:** none.
- **Inputs:** none.
- **Output:** JSON `{ status, checks: { app, database, payments }, integrations: { configured[], total }, time }`. `checks.database = isLiveSupabase()`, `checks.payments = isStripeConfigured()`. HTTP 200 when app is live, 503 when degraded. `Cache-Control: no-store`. Never leaks secrets — only booleans/keys.
- **Side effects:** none.

### 1.2 `GET /api/recommendations` — `src/app/api/recommendations/route.ts`
- **Method:** GET (force-dynamic).
- **Purpose:** Homepage/discovery shelves (recommended, trending, top_rated, new, available_today, luxury).
- **Auth:** none; **rate-limited** by IP via `rateLimit("search", ip, …)` → 429 on exceed (IP from `x-forwarded-for`).
- **Inputs:** query `shelf` (must be in VALID list, else 400), `limit` (clamped 1–24, default 8).
- **Output:** JSON `{ shelf, title, count, results[] }` where each result is a projected pro card (slug, name, specialty, rating, reviews, startingPriceCents, distanceMi, verified, categories). Data via `getShelf()`.
- **Side effects:** none (read-only).

### 1.3 `GET /api/search/suggest` — `src/app/api/search/suggest/route.ts`
- **Method:** GET (force-dynamic).
- **Purpose:** Search autocomplete + popular searches.
- **Auth:** none; **rate-limited** by IP (`rateLimit("search", …)` → 429).
- **Inputs:** query `q` (trimmed; empty returns `{ suggestions: [], popular }`).
- **Output:** JSON `{ query, suggestions (top 8), popular }`. Corpus of professionals+services cached 60s in `appCache` via `getOrSet`; response `Cache-Control: private, max-age=15`.
- **Side effects:** populates the shared suggest corpus cache.

### 1.4 `POST /api/stripe/webhook` — `src/app/api/stripe/webhook/route.ts`
- **Method:** POST.
- **Purpose:** **Source of truth for payment state.** Reconciles bookings/payments/earnings from Stripe events.
- **Auth/verification:** Stripe **signature verification** via `stripe.webhooks.constructEvent(body, sig, STRIPE_WEBHOOK_SECRET)`. Missing signature → 400; invalid → 400. Returns 503 if Stripe/webhook secret not configured. Uses the **service-role admin client** for all DB writes.
- **Exactly-once:** inserts `event.id` into `stripe_events` first; unique-violation (`23505`) → acknowledges as duplicate without re-applying; on handler failure the dedup marker is deleted so Stripe retries. Returns 200 on handled/duplicate, 500 only on genuine failure.
- **Inputs:** raw request body (Stripe event) + `stripe-signature` header.
- **Handled event types & side effects:**
  | Event | Side effects |
  |-------|--------------|
  | `payment_intent.succeeded` | Upsert `payments` (succeeded, keyed on PI); update booking → `confirmed` only if still `pending_payment` (guards out-of-order); insert booking_status_event; **unlock conversation** (`is_unlocked=true`); upsert pending `earnings_ledger` earning = total − platform_fee (idempotent on booking_id,kind). |
  | `payment_intent.payment_failed` | Upsert `payments` status `failed`. |
  | `payment_intent.canceled` | Booking → `cancelled_customer` if still pending (reason "Checkout expired/cancelled"). |
  | `charge.refunded` | Set payment → refunded; upsert `earnings_ledger` `refund_adjustment` (negative, available). |
  | default | Acknowledged (200) so Stripe stops retrying. |
- **Metadata contract:** relies on `metadata.bookingId` on the PaymentIntent (set by the checkout action).

### 1.5 `GET /api/wellknown/aasa` — `src/app/api/wellknown/aasa/route.ts`
- **Method:** GET (`dynamic = "force-static"`). Rewritten to `/.well-known/apple-app-site-association` in `next.config`.
- **Purpose:** Apple Universal Links + webcredentials association.
- **Auth:** none. **Inputs:** none (env `APPLE_APP_ID`, default `TEAMID.com.iglamher.app`).
- **Output:** JSON `applinks` (paths: /discover, /professionals/*, /services/*, /book/*, /categories/*, /account/*, /messages/*) + `webcredentials`.
- **Side effects:** none.

### 1.6 `GET /api/wellknown/assetlinks` — `src/app/api/wellknown/assetlinks/route.ts`
- **Method:** GET (force-static). Rewritten to `/.well-known/assetlinks.json`.
- **Purpose:** Android App Links association (Digital Asset Links).
- **Auth:** none. **Inputs:** env `ANDROID_PACKAGE` (default `com.iglamher.app`), `ANDROID_SHA256`.
- **Output:** JSON array with `delegate_permission/common.handle_all_urls` + package/SHA-256 fingerprint.
- **Side effects:** none.

---

## Part 2 — Server Actions (`"use server"`)

All actions validate with Zod, gate on `isLiveSupabase()` (demo mode returns friendly errors / synthetic results), and authenticate via `supabase.auth.getUser()`. Privileged writes use `createAdminClient()` (service-role) only **after** a server-side role check. "Mutates" lists the tables touched.

### 2.1 Auth — `src/lib/auth/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `signUpAction` | Email/password sign-up; role defaults to customer via DB trigger | rate-limit `auth`; Zod | `auth.users` (Supabase Auth); trigger creates profiles/customer_profiles |
| `signInAction` | Password sign-in, then redirect to safe `next` | rate-limit `auth`; Zod | session |
| `signOutAction` | Sign out, redirect `/signin` | session | session |
| `forgotPasswordAction` | Send reset email | Zod | — (Supabase Auth email) |
| `resetPasswordAction` | Update password, redirect `/discover` | Zod; active recovery session | `auth.users` |

### 2.2 Booking — `src/lib/booking/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `createBookingDraftAction` | Create a pending-payment booking. Price **recomputed server-side** from stored service data (never trusted from client). Honors `bookings_paused` kill-switch. Demo mode returns synthetic draft. | authenticated; kill-switch; Zod | `bookings`, `booking_line_items`, `booking_status_events` via `create_booking()` RPC (atomic, exclusion-constraint → SLOT_TAKEN) |
| `updateBookingStatusAction` | accept/start/complete/reject/cancel/no-show transitions; validates actor is the correct party + `canTransition`; awards loyalty on completion | authenticated + party check | `bookings`, `booking_status_events`; `loyalty_*` on completion |

### 2.3 Payments — `src/lib/payments/actions.ts`, `connect-actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `createCheckoutSessionAction` | Create a Stripe Checkout session for a booking's amount-due. Amount read authoritatively from persisted booking; must be caller's own booking and `pending_payment`. Sets `metadata.bookingId`. | authenticated + owner + status check; Stripe configured | none in DB (Stripe session only; webhook reconciles) |
| `startConnectOnboardingAction` | Ensure a Connect account + return onboarding link | `requirePro` (professional/admin) + Stripe | Connect account (Stripe); pro `stripe_account_id` via helper |
| `refreshConnectStatusAction` | Sync Connect status from Stripe | `requirePro` | `professional_profiles` connect_* fields via `syncConnectStatus` |

### 2.4 Professional — `src/lib/pro/actions.ts`
Guard `requirePro()`: authenticated + `profiles.role` is professional/admin. RLS + column-guard triggers are the DB backstop; `is_active`/`is_verified` intentionally **not** settable here.
| Action | Purpose | Mutates |
|--------|---------|---------|
| `saveServiceAction` | Create/update a service (owner-scoped `.eq(professional_id)`) | `services` |
| `archiveServiceAction` | Soft-delete a service (`deleted_at`, is_active=false) | `services` |
| `saveAvailabilityAction` | Save timezone/notice/window + replace weekly rules | `professional_profiles`, `availability_rules` |
| `saveProfileAction` | Update public profile fields | `professional_profiles` |
| `deletePortfolioItemAction` | Remove a portfolio item (owner-scoped) | `professional_portfolio_items` |
| `setCoverPortfolioItemAction` | Set one cover (clears others first) | `professional_portfolio_items` |

### 2.5 Messaging — `src/lib/messaging/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `sendMessageAction` | Send a message; enforces the **pre-payment contact-info guard** server-side — before `conversations.is_unlocked`, contact info is blocked and logged (flagged/redacted); membership also enforced by RLS | authenticated; Zod | `messages` (incl. blocked/flagged log rows), `conversations.last_message_at` |

### 2.6 Marketplace favorites — `src/lib/marketplace/favorites-actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `toggleFavoriteAction` | Favorite/unfavorite an **active** professional | authenticated (needsAuth flag for guests) | `favorites` |
| `recordProfessionalViewAction` | Record a profile view (guests skipped) | authenticated | `recently_viewed` (upsert) |

### 2.7 Account avatar — `src/lib/account/avatar-actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `updateAvatarAction` | Upload profile photo (jpeg/png/webp, ≤5 MB). Storage write via **service-role** admin client to public `avatars` bucket; DB update via user's own client so RLS enforces self-update. Creates bucket idempotently. | authenticated; MIME/size validation | `storage.objects` (avatars), `profiles.avatar_url` |

### 2.8 Loyalty — `src/lib/loyalty/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `redeemPointsAction` | Redeem points ($5–$500) → account credit; checks balance via `canRedeem` | authenticated; Zod; service-role writes (loyalty tables read-only via RLS) | `loyalty_accounts`, `loyalty_transactions`, `account_credits` |

### 2.9 Referral — `src/lib/referral/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `applyReferralCodeAction` | Apply a referral code (fraud-checked, one per referred user), grant welcome credit | authenticated; Zod; service-role | `referrals`, `account_credits` |

### 2.10 Native push — `src/lib/native/push-actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `registerDeviceTokenAction` | Register APNs/FCM/Web Push token (upsert on user_id,token) | authenticated; Zod | `device_tokens` |
| `removeDeviceTokenAction` | Remove a device token | authenticated | `device_tokens` |

### 2.11 User moderation — `src/lib/moderation/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `reportContentAction` | Report content (feeds admin queue) | authenticated; Zod | `content_reports` |
| `blockUserAction` | Block a user (not self) | authenticated | `blocks` |
| `unblockUserAction` | Unblock | authenticated | `blocks` |

### 2.12 Admin (Phase 3) — `src/lib/admin/actions.ts`
Guard `requireAdmin()`: session `profiles.role === "admin"`; writes via **service-role** admin client.
| Action | Purpose | Mutates |
|--------|---------|---------|
| `setProfessionalActiveAction` | Approve/deactivate a pro (go-live) | `professional_profiles.is_active` |
| `setProfessionalFeaturedAction` | Feature/unfeature | `professional_profiles.is_featured` |
| `setPortfolioHiddenAction` | Hide/show a portfolio item | `professional_portfolio_items.is_hidden` |
| `setCategoryActiveAction` | Enable/disable a category | `categories.is_active` |

### 2.13 Admin trust & safety — `src/lib/admin/trust-actions.ts`
`requireAdmin()` + **audit-logged** (`writeAudit`) + service-role. Fraud/safety actions **freeze, never delete**.
| Action | Purpose | Mutates |
|--------|---------|---------|
| `decideVerificationAction` | approve/reject/request_info/suspend/revoke a pro verification; syncs `is_verified` | `professional_verifications`, `professional_profiles.is_verified`, `audit_logs` |
| `resolveDisputeAction` | refund/partial/reject/escalate/freeze_payout/request_evidence; freezes payouts when directed | `disputes`, `professional_profiles.payouts_frozen`, `dispute_events`, `audit_logs` |
| `resolveReportAction` | reviewing/actioned/dismissed a content report | `content_reports`, `audit_logs` |
| `setAccountFreezeAction` | Freeze/unfreeze account or payouts | `professional_profiles.is_frozen`/`payouts_frozen`, `audit_logs` |

### 2.14 Marketing — `src/lib/marketing/actions.ts`
`requireAdmin()` + audit-logged + service-role.
| Action | Purpose | Mutates |
|--------|---------|---------|
| `createCampaignAction` | Create a marketing campaign | `campaigns`, `audit_logs` |
| `toggleCampaignAction` | Activate/deactivate a campaign | `campaigns`, `audit_logs` |

### 2.15 Ops / platform settings — `src/lib/ops/actions.ts`
| Action | Purpose | Auth guard | Mutates |
|--------|---------|-----------|---------|
| `setPlatformSettingAction` | Set an allowed platform kill-switch (`maintenance_mode`, `bookings_paused`, `payments_paused`, `beta`); busts the 15s settings cache | admin role check (inline); allow-list; service-role | `platform_settings`, `audit_logs` |

---

## Notes / Observations
- **Auth model:** REST is read-only/public except the signature-verified Stripe webhook; all authenticated mutation goes through server actions. This keeps the anon/PostgREST surface behind RLS + column-guard triggers (see `09-database-schema.md` §5).
- **Server-authoritative money:** both `createBookingDraftAction` and `createCheckoutSessionAction` recompute/read amounts server-side; the webhook is the reconciliation source of truth.
- **Idempotency:** Stripe webhook uses `stripe_events` dedupe + upserts keyed on payment intent / `(booking_id, kind)`.
- **Demo mode:** every action degrades gracefully when `isLiveSupabase()` is false (synthetic/booking-blocked responses) so the UI works without a backend.
