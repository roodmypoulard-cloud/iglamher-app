# Product Decisions & Deferred Integrations

Per CLAUDE.md rule 12, non-spec choices and deferrals are logged here.

## 2026-07-22 — Payouts: Stripe Connect **Express** (Stripe-hosted onboarding) — FINAL

**Decision (owner: Roodmy):** Pros onboard for payouts through **Stripe-hosted Express**
onboarding — not an in-app bank/SSN form. Connect accounts are `type: "express"`
(payout-only: `transfers` + `card_payments` capabilities, `business_type: "individual"`,
MCC `7230`). This **supersedes and reverses** the earlier same-day Custom decision.

**Why Express over Custom:**
- **1099 tax reporting is handled by Stripe.** Express connected accounts get their
  `1099-K`/`1099-NEC` generated and filed by Stripe (enable Connect tax reporting in the
  Dashboard); with Custom, iGlamHer would own 1099 generation and filing itself.
- **Far less KYC / compliance liability.** Stripe hosts identity, bank, and tax-info
  collection and owns KYC, verification, disclosures, and the Services Agreement. We never
  see or store SSN, DOB, or raw bank numbers — shrinking our PII surface and audit scope.
- **No platform approval gate.** Express works in live mode without Stripe having to
  specially enable Custom for the platform (which Custom requires).
- **Faster, lower-maintenance onboarding.** Stripe maintains the flow, localizations, and
  requirement prompts; we just deep-link into it and read back account status.

**How it works:**
- `ensureConnectAccount` creates/reuses the pro's Express account; `createOnboardingLink`
  returns a Stripe-hosted `account_onboarding` link (return/refresh → `/pro/earnings`).
- Payout eligibility is derived from Stripe's own flags
  (`details_submitted` / `charges_enabled` / `payouts_enabled`) via `syncConnectStatus`,
  mirrored onto `professional_profiles` for fast checks — never self-reported.
  `requirements.currently_due` is surfaced in the UI so a stuck pro sees exactly what's left.
- **Money flow = separate charges + transfers (unchanged):** the platform collects the
  deposit and (at completion) the balance onto the **platform** account, keeping its
  commission; `transferBookingPayout` then `Transfer`s the pro's net to their connected
  account. Payout is **deferred to service completion** (after the balance is captured),
  so a payout can never exceed funds actually collected. Refunds reverse the transfer
  proportionally (`reverseBookingPayout`). Idempotent per booking.
- Files: `src/lib/payments/connect.ts` (Express account + hosted link + status sync),
  `connect-actions.ts` (`startConnectOnboardingAction`, `refreshConnectStatusAction`),
  `src/lib/payments/payouts.ts` (transfers/reversals), wired into
  `src/components/pro/ConnectPayouts.tsx`. The in-app `PayoutBankForm.tsx` +
  `savePayoutMethodAction` (Custom bank/SSN entry) were **removed**.
- **Trade-off accepted:** payouts require the pro to complete a short Stripe-hosted flow
  (a redirect out of the app) rather than a fully in-app form — worth it for the reduced
  liability and Stripe-managed 1099s.

**Dashboard follow-up:** enable **Connect → 1099 tax reporting** (see README / go-live
notes) so Stripe files pros' 1099s automatically.

## Phase 5 — Booking engine & marketplace core

### Built and verified (offline-testable)
- **Booking engine**: price + commission math (`src/lib/booking/pricing.ts`), status
  machine (`status.ts`), atomic no-double-booking via the `create_booking()` SQL
  function + exclusion constraint (`migrations/0005`). Unit-tested (pricing,
  cancellation, status). Booking flow UI end-to-end (`/book/[slug]`), Playwright-covered.
- **Contact-info guard** (`src/lib/messaging/contact-guard.ts`): the mandatory
  pre-payment rule — detects/redacts phone, email, links, social handles, and
  spelled-out evasions. Heavily unit-tested. Enforced server-side in `sendMessageAction`.
- **Customer dashboard** (`/account`), booking status actions, saved payment
  methods / disputes / messaging-gate schema, indexes, RLS.

### Wired but require external credentials to go live (NOT claimed working)
These are coded against real APIs and gated on env; they activate when credentials exist.
- **Stripe Connect** (`src/lib/payments/stripe.ts`, `/api/stripe/webhook`): needs a
  Stripe account + `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, connected pro
  accounts. Destination-charge + application-fee (commission) flow is implemented;
  Apple Pay / Google Pay ride on Stripe's `automatic_payment_methods`.
- **Google / Apple sign-in** (`OAuthButtons`): needs the providers enabled in the
  Supabase dashboard with client IDs/secrets.
- **Live persistence** (bookings, messages, real dashboards): needs a Supabase project.
  Everything runs in **seed/demo mode** until then.

### Deferred (not started — need a provider decision + accounts)
- **In-app voice calling**: requires a WebRTC/telephony provider (Twilio Programmable
  Voice, LiveKit, or Daily) for signaling + TURN + number masking. No masked-number
  provider is configured, so this was not stubbed as if working.
- **Push notifications (APNs/FCM)**: the in-app notification center + model exist
  (Phase 4); real push needs APNs certs / FCM keys and a device-token store.
- **Realtime messaging transport**: schema + guard + send action exist; Supabase
  Realtime subscription (typing indicators, read receipts live updates) turns on
  with a live project.

## Phase 6 — Trust, Safety & Operations

### Built and verified (offline-testable)
- **Reliability + trust scoring** (`lib/trust/reliability.ts`) — stylist/customer
  reliability scores; repeated cancellations lower the ranking multiplier. **Wired
  into search ranking** (trust influences visibility — mandatory rule). Unit-tested.
- **Trust badges** (`lib/trust/badges.ts` + `TrustBadges` UI) — Identity Verified,
  Licensed, Insured, Top Rated, Background Checked; derived from verification state,
  never self-set. Unit-tested; shown on the profile.
- **Fraud risk scoring** (`lib/trust/fraud.ts`) — weighted heuristic over collected
  signals → 0–100 risk + reasons. Unit-tested.
- **Block/privacy guards** (`lib/privacy/blocks.ts`) — symmetric blocks deny
  message/book/call/view; privacy visibility tiers. Unit-tested.
- **Multi-dimension review aggregation** (`lib/reviews/aggregate.ts`) — 6 dimensions,
  distribution, lifetime rating, repeat-customer %. Unit-tested.
- **Schema (migration 0006)**: verification docs + trust flags, review dimensions +
  helpful votes, content_reports + moderation, blocks, privacy_settings, fraud_flags,
  dispute evidence + timeline, reliability metrics, audit indexes. RLS on all.
- **Audit logging** (`lib/audit/log.ts`) wired into every admin action; immutable
  (no client write policy). **Admin ops dashboard** with metrics + queues.
- **Server actions**: verification decisions, dispute resolution (refund/partial/
  reject/escalate/freeze-payout), report moderation, account freeze (never delete),
  user report/block — all Zod-validated, admin-gated, audit-logged.

### Deferred (need external infra — NOT claimed working)
- **Document encryption at rest** + **virus scanning** of uploads — need a KMS/
  encrypted bucket + a scanning service (e.g. ClamAV/VirusTotal). Storage columns
  and upload validation exist; the encryption/scan step does not.
- **Device fingerprinting / IP-geo signal collection** — the fraud SCORER is built
  and tested; the instrumentation that produces `FraudSignals` needs a client SDK
  (e.g. FingerprintJS) + IP intelligence.
- **Live selfie liveness check** — needs an identity provider (Stripe Identity, Persona).
- **JWT rotation / refresh-token internals / session monitoring** — handled by
  Supabase Auth; deeper controls need its admin APIs + a live project.
- **Background jobs / queues** (reliability recompute, verification expiry, reminders)
  — need a scheduler (Supabase cron / Inngest); the pure recompute logic is ready.

## Phase 7 — buildable batch (done + verified, no vendor accounts needed)
- **AI matching / Recommended-for-you** (`lib/recommend/`) — personalized weighted
  scoring; live on Discover.
- **Analytics** (`lib/analytics/`) — GMV, revenue, DAU/MAU, retention, funnel, CLV,
  cancellation/repeat rates; `/admin/analytics`.
- **Provider growth** (`lib/growth/`) — earnings, repeat rate, weekly trend, forecast,
  optimization tips; `/pro/earnings`.
- **Referrals** (`lib/referral/`) — deterministic codes, fraud checks, rewards; `/account/rewards`.
- **Loyalty / iGlam Rewards** (`lib/loyalty/`) — points, tiers, milestones, redemption;
  earns on booking completion; `/account/rewards`.
- **Marketing** (`lib/marketing/`) — campaigns, %/fixed discounts, geo-targeting,
  deterministic A/B; `/admin/campaigns`.
- **Admin command center** — analytics/campaigns links + live integration-status panel.
- **NL search** (`lib/search/parse`) — parses "natural glam under $150" → category+price
  filters; wired into `/search`, upgrades to embeddings when OPENAI_API_KEY set.
- Migration **0008_growth.sql** adds the tables (loyalty, referrals, campaigns,
  analytics_events, account_credits) with RLS. Apply to the live DB to persist.
- Tests: 126 unit + 52 Playwright, all green.

## Integration abstraction layers (add API keys later — `lib/integrations/`)
Each: interface + env-gated wrapper + working local fallback + documented integration point.
- `notifications.ts` — email(Resend)/SMS(Twilio)/push(APNs/FCM); always writes in-app.
- `search.ts` — semantic search (OpenAI embeddings) over keyword fallback.
- `identity.ts` — Persona / Stripe Identity ID+selfie verification sessions.
- `fraud-signals.ts` — FingerprintJS enrichment over DB-derived signals → `scoreFraud`.
- `config.ts` — `integrationStatus()` powers the admin Integrations panel.

## Recommendations
- Stand up a Supabase project + Stripe test account first — unlocks the largest share
  of "wired but dormant" functionality with no code changes.
- For voice, evaluate Twilio vs LiveKit for cost + number-masking before building.
- For fraud + identity, evaluate FingerprintJS + Stripe Identity/Persona.

## Customer Mode refinement + Job Marketplace (2026-07-23)
- **Customer Mode is pro-free**: removed "Complete Professional Setup", "You're a
  Pro!", "Become a pro" tile (/account), and the pro-dashboard shortcuts from all
  customer surfaces. The Professional Profile settings card now renders only in
  Professional Mode. KEPT one discreet "Become a beauty professional" entry in
  Account Settings → Account Mode (settings = account management; removing every
  conversion path would kill pro-supply acquisition — flag if it should go too).
- **Header**: top-right avatar replaced by a rose-gold hamburger (AppHeader +
  DiscoverTopbar) → /profile/settings. Profile itself lives on the bottom-nav
  Profile tab. ViewerAvatar.tsx is now orphaned (kept one release for safety).
- **Create-Job FAB**: bottom-nav center "+" is now the Job Marketplace entry
  (/requests) — metallic rose-gold, glow + periodic shine, press animation
  (`fab-gold` utilities; motion gated on prefers-reduced-motion). The old
  "+ → /search" behavior is covered by Discover's search bar.
- **Customer Job Marketplace** (migration 0027, `lib/requests/`, `/requests[/new|/[id]]`):
  customers post beauty job requests (8 categories, description, ≤4 inspiration
  photos → public `portfolio` bucket under `job-requests/{uid}/`, date, time
  window, location, house-call flag, optional budget in cents). RLS: owner CRUD,
  any signed-in user reads OPEN requests — Professional Mode can consume the same
  policy later with zero schema change. Column guard: owner edits only while
  open; only self-service transition is open→cancelled.
- **Support**: SupportLink opens the native composer prefilled (subject + app
  version/platform/screen); visibility-based fallback sheet with copy button when
  no mail handler exists. Used in Account Settings + Profile tile.
- **404 semantics**: routes with loading.tsx stream, so browsers get 200 + the
  not-found UI; generateMetadata on /professionals/[slug] calls notFound()
  pre-stream so crawlers still get a real 404. E2E specs assert the UI, not status.
- **Recommended pros / $2.99 subscription (2026-07-23)**: category pages show a
  "Recommended · Sponsored" section first, sourced from the existing
  `professional_profiles.is_featured` flag (admin-guarded since 0005cg/0026;
  toggled via setProfessionalFeaturedAction). Decision: do NOT build Stripe
  Billing for the $2.99/mo recommendation sub yet — admins flip `is_featured`
  manually when a pro pays. TODO when volume justifies: Stripe Price ($2.99/mo)
  + checkout + `customer.subscription.updated/deleted` webhook syncing
  `is_featured`. Ranking already weighs `featured`, so search/discover order is
  consistent with the category page.

## "iGlamHer Recommended" curated placement (2026-07-23)
- Home hero chip "Easy Booking" (how-it-works sheet, redundant with /how-it-works)
  replaced by "Recommended" → /recommended: only pros WE approve (admin toggle on
  /admin, gold "★ Recommended" chip, audit path via setProfessionalRecommendedAction).
- Monetization-ready by design, FREE at launch: professional_profiles.is_recommended
  + recommended_at + recommended_until (0028). NULL until = active (free era);
  when the $2.99/mo placement subscription ships, the Stripe webhook maintains
  recommended_until each period — lapsed payment auto-drops the placement with
  zero schema change. Column guard extended: placement is platform-only (a pro
  can never PATCH themselves into the paid shelf).
- EasyBookingSheet.tsx deleted (booking explainer lives at /how-it-works).

## Everything-to-10 hardening pass (2026-07-25)
- **Referral rewards deferred to first paid booking.** Welcome credit used to be
  granted the moment a code was applied — free money for throwaway sign-ups.
  Now nothing is granted at apply; ALL rewards (referred welcome credit,
  referrer credit + points) grant once in `src/lib/referral/qualify.ts` on the
  referred user's first paid booking (status-guarded `pending→rewarded` flip in
  the payment webhook). This also implemented the referrer payout, which was
  documented but never wired. Dead `sameDevice`/`sameIp` fraud inputs removed
  rather than pretending device fingerprinting exists.
- **Reschedule shipped on existing rails (0036).** `change_requested` existed in
  the status machine since 0001 with no action/UI. Decision: propose/accept/
  decline on the shared booking detail page, original slot stays reserved until
  acceptance, `bookings_no_overlap` guards the new time. No calendar-sync or
  multi-slot negotiation — that's future work if demand shows.
- **Public visibility = active AND admin-approved** at every layer (service
  layer previously only checked `isActive`, so single-profile fetches could
  surface unapproved pros the list query filtered). Stripe-Connect readiness
  deliberately does NOT gate visibility: deposits are platform charges, so an
  un-onboarded pro can safely take bookings — their payout waits in the
  earnings ledger until Connect onboarding completes.
- **Rate limiting**: Upstash Redis (distributed) when configured, else
  per-instance memory — documented degradation, never silent. New limits on
  booking create / messages / loyalty / referral / report+block.
