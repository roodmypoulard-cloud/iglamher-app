# iGlamHer — Database Schema Audit

Source of truth: `supabase/migrations/*.sql` (0001–0010) plus `supabase/storage-policies.sql`. Conventions declared in `0001_schema.sql`: UUID primary keys, `timestamptz` in UTC, all money in **integer cents**. Extensions enabled: `pgcrypto`, `btree_gist` (overlap exclusion), `postgis` (geography), later `pg_trgm` (0004), and optionally `pg_cron`/`pg_net` (0007).

---

## 1. Migration Index (in apply order)

| File | One-line description |
|------|----------------------|
| `0001_schema.sql` | Core schema: 9 enums, identity/catalog/availability/bookings/payments/reviews/messaging/notifications/promos/admin tables, indexes, no-double-booking exclusion constraint. |
| `0002_functions.sql` | Functions & triggers: `set_updated_at`, `is_admin`, `handle_new_user` (auto profile), role-escalation guard, rating denormalization, review-eligibility enforcement. |
| `0003_rls.sql` | Enables RLS on all core tables and defines ownership/role client policies (admin & audit tables get none = deny). |
| `0004_marketplace.sql` | Marketplace enrichment: pro public-profile fields, generated FTS `search_document`, service instant-book/travel fee + sanity checks, portfolio moderation, `recently_viewed`, trigram/GIN/GIST search indexes, tightened portfolio RLS. |
| `0005_booking_engine.sql` | `dispute_status` enum, booking timestamp cols, `saved_payment_methods`, `disputes`, messaging unlock/flag columns, `create_booking()` atomic RPC, booking indexes. |
| `0005_column_guards.sql` | BEFORE-UPDATE triggers closing the "RLS grants whole rows" gap: column guards on professional_profiles, bookings, reviews; tightens availability + promo read policies. |
| `0006_trust_safety.sql` | Verification-status/dispute enum extensions; report/fraud enums; verification docs & trust flags; reliability/safety flags on profiles & customers; multi-dimension reviews + helpful votes; `content_reports`, `blocks`, `privacy_settings`, `fraud_flags`, `dispute_evidence`, `dispute_events`; indexes. |
| `0007_jobs.sql` | Maintenance routines (`expire_stale_pending_bookings`, `expire_verifications`, `recompute_reliability`) + pg_cron schedules. |
| `0008_growth.sql` | Growth engine: `analytics_events`, loyalty accounts/transactions, `account_credits`, `referral_codes`/`referrals`, `campaigns`/`campaign_redemptions`, RLS. |
| `0009_launch_ops.sql` | Launch ops: `stripe_events` (webhook idempotency), `platform_settings` (kill-switches, seeded), Connect payout columns on pro profile, `earnings_ledger`, `beta_access_codes`/`beta_invites`. |
| `0010_mobile.sql` | Mobile backend: `device_tokens` (APNs/FCM/Web Push), `notification_preferences`. |
| `supabase/storage-policies.sql` | Storage buckets (`verification-documents` private, `portfolio` public) + object policies. (`avatars` bucket is created at runtime by app code.) |

Note: there are two `0005_` migrations (`booking_engine` and `column_guards`); both are append-only and independent.

---

## 2. Enums / Types

| Type | Values | Defined / extended in |
|------|--------|-----------------------|
| `user_role` | customer, professional, admin, support | 0001 |
| `location_type` | studio, mobile, both | 0001 |
| `media_kind` | image, video, instagram | 0001 |
| `verification_status` | unsubmitted, pending, approved, rejected, **more_info_requested, suspended, revoked** | 0001; +0006 |
| `booking_status` | pending_payment, confirmed, change_requested, in_progress, completed, cancelled_customer, cancelled_professional, refunded, disputed, no_show | 0001 |
| `payment_status` | requires_payment, processing, succeeded, failed, refunded, partially_refunded | 0001 |
| `payout_status` | pending, in_transit, paid, failed, reversed | 0001 |
| `notif_type` | booking, message, review, payout, system, promo | 0001 |
| `admin_role_kind` | admin, support | 0001 |
| `dispute_status` | open, under_review, resolved_refund, resolved_declined, cancelled, **awaiting_response, under_investigation, closed** | 0005_booking_engine; +0006 |
| `report_reason` | harassment, fraud, spam, inappropriate, fake_profile, safety, copyright, other | 0006 |
| `report_status` | open, reviewing, actioned, dismissed | 0006 |
| `fraud_status` | flagged, reviewing, cleared, actioned | 0006 |

---

## 3. Tables by Domain

### 3.1 Identity / Profiles

**`profiles`** (0001) — one row per `auth.users` id.
| Column | Type | Notes |
|--------|------|-------|
| id | uuid | PK, FK → auth.users(id) ON DELETE CASCADE |
| role | user_role | NOT NULL default `customer`; change-guarded by trigger |
| full_name | text | |
| avatar_url | text | set by avatar upload action (0-migration; app writes) |
| phone | text | private, never exposed cross-party |
| timezone | text | NOT NULL default `America/Los_Angeles` |
| created_at / updated_at | timestamptz | NOT NULL default now(); updated_at maintained by trigger |

**`customer_profiles`** (0001, extended 0006)
| Column | Type | Notes |
|--------|------|-------|
| user_id | uuid | PK, FK → profiles(id) CASCADE |
| default_address_id | uuid | FK → addresses(id) ON DELETE SET NULL (added after addresses) |
| notif_email / notif_sms / notif_push | boolean | NOT NULL default true |
| onboarding_complete | boolean | NOT NULL default false |
| is_id_verified | boolean | +0006, default false |
| verification_status | verification_status | +0006, default unsubmitted |
| id_document_url, selfie_url | text | +0006 |
| reliability_score | integer | +0006, default 80 |
| cancellation_rate | numeric(5,2) | +0006 |
| is_frozen | boolean | +0006, default false |
| created_at / updated_at | timestamptz | default now() |

**`professional_profiles`** (0001, heavily extended 0004/0006/0009) — PK `user_id` FK → profiles(id).
Key columns: `slug` (unique, NOT NULL), `business_name` (NOT NULL), `headline`, `bio`, `location_type` (default mobile), `studio_address`, `geo` (geography point), `service_radius_miles`, `instagram_handle`, `ig_follower_count`, `cover_url`, `location_lat/lng`, `cancellation_policy` jsonb, `onboarding_step`/`onboarding_complete`, `is_active` (admin-gated go-live, default false), `is_verified`, `is_featured`, `take_rate_bps` (default 1500 = 15% platform fee), `stripe_account_id` (unique), `rating_average`/`review_count`/`jobs_completed`/`starting_price_cents` (denormalized).
- **+0004:** `avatar_url`, `primary_specialty`, `specialties` text[], `years_experience`, `languages` text[], `city`, `postal_code`, `instant_book`, `timezone`, `min_notice_minutes` (120), `max_window_days` (60), `last_active_at`, and generated `search_document` tsvector.
- **+0006:** `reliability_score` (80), `acceptance_rate`, `completion_rate`, `cancellation_rate`, `require_verified_customers`, `is_frozen`, `payouts_frozen`.
- **+0009 (Connect):** `connect_details_submitted`, `connect_charges_enabled`, `connect_payouts_enabled`, `connect_onboarded_at`.
- Indexes: partial on `is_active`/`is_featured`, `rating_average desc`, `reliability_score desc`, GIN FTS on `search_document`, trigram GIN on `business_name`/`city`, GIST on `geo`.

### 3.2 Trust & Safety / Verification

**`professional_verifications`** (0001, extended 0006) — PK id, FK `professional_id` → professional_profiles(user_id).
Columns: `status` (verification_status), `id_document_url`, `license_url`, `notes`, `reviewed_by` (FK profiles), `reviewed_at`, timestamps. +0006: `selfie_url`, `business_license_url`, `insurance_url`, `license_verified`, `insured`, `background_checked`, `requested_info`, `expires_at`. Index on `status`, on `professional_id`.

**`content_reports`** (0006) — PK id; `reporter_id` FK, `target_type` (user|professional|message|review|portfolio), `target_id` uuid, `reason` (report_reason), `detail`, `status` (report_status default open), `resolved_by`, `resolution`, timestamps. Indexes on (status,created_at desc) and (target_type,target_id).

**`blocks`** (0006) — PK (blocker_id, blocked_id), both FK → profiles CASCADE, CHECK blocker≠blocked. Index on blocked_id.

**`privacy_settings`** (0006) — PK user_id; `profile_visibility` (public|verified_only|private), `allow_messages`, `allow_calls`, `mute_notifications`.

**`fraud_flags`** (0006) — PK id; `user_id` FK, `kind`, `score`, `severity`, `detail` jsonb, `status` (fraud_status). **RLS on, no client policy = deny (admin/service-role only).** Index (status, score desc).

**`review_helpful_votes`** (0006) — PK (review_id, user_id).

### 3.3 Catalog / Marketplace / Services

**`categories`** (0001) — PK id; `slug` unique, `name`, `description`, `image_url`, `is_active`, `sort_order`.

**`services`** (0001, extended 0004) — PK id; `professional_id` FK CASCADE, `category_id` FK, `name`, `description`, `duration_minutes` (>0; +0004 CHECK 1–1440), `price_cents` (≥0), `price_is_from`, `deposit_type` (default 'full'), `deposit_value`, `location_type`, `buffer_before/after_minutes` (+0004 CHECK 0–240), `is_active`, `deleted_at` (soft-delete), `sort_order`, timestamps. +0004: `instant_book`, `travel_fee_cents`. Indexes: partial on professional_id (active, not-deleted), category_id, trigram on name.

**`service_addons`** (0001) — PK id; `professional_id` FK, `name`, `price_cents` (≥0), `is_active`.

**`professional_portfolio_items`** (0001, extended 0004) — PK id; `professional_id` FK, `kind` (media_kind), `url`, `thumb_url`, `ig_permalink`, `caption`, `sort_order`. +0004: `is_hidden` (admin hide), `is_cover`, `service_id`/`category_id` FKs, `width`/`height`. Unique partial index: one cover per pro.

**`recently_viewed`** (0004) — PK (customer_id, professional_id), `viewed_at`. Index (customer_id, viewed_at desc).

### 3.4 Availability

**`availability_rules`** (0001) — PK id; `professional_id` FK, `weekday` (0–6), `start_minute`/`end_minute` (0–1440, end>start).

**`availability_exceptions`** (0001) — PK id; `professional_id` FK, `starts_at`/`ends_at` (end>start), `is_available` (false=blocked/true=extra), `reason`.

### 3.5 Addresses / Favorites

**`addresses`** (0001) — PK id; `user_id` FK CASCADE, `label`, `line1` (NOT NULL), `line2`, `city` (NOT NULL), `state`, `postal_code`, `country` char(2) default US, `lat`/`lng`, `is_default`.

**`favorites`** (0001) — PK (customer_id, professional_id), both FK CASCADE. Index on professional_id (0004).

### 3.6 Bookings

**`bookings`** (0001, extended 0005) — PK id.
| Column | Type | Notes |
|--------|------|-------|
| customer_id | uuid | FK → profiles ON DELETE RESTRICT |
| professional_id | uuid | FK → professional_profiles(user_id) RESTRICT |
| service_id | uuid | FK → services |
| status | booking_status | default pending_payment |
| starts_at / ends_at | timestamptz | ends>starts |
| timezone | text | NOT NULL |
| location_type | location_type | NOT NULL |
| address_id | uuid | FK → addresses |
| currency | char(3) | default USD |
| service_name_snapshot | text | snapshotted, immutable (guard trigger) |
| subtotal/addons/onsite_upcharge/fees/tax/discount/tip/total/amount_due_now/platform_fee `_cents` | integer | snapshotted pricing, guard-immutable |
| stripe_payment_intent_id | text | unique |
| cancellation_policy_snapshot | jsonb | |
| customer_notes | text | |
| reserves_time | boolean | default true (drives overlap exclusion) |
| time_range | tstzrange | GENERATED from starts/ends `[)` |
| cancellation_reason, cancelled_at, confirmed_at, completed_at | | +0005_booking_engine |

- **Exclusion constraint `bookings_no_overlap`** (GIST): same `professional_id` cannot have two `reserves_time` bookings with overlapping `time_range` while status in (pending_payment, confirmed, change_requested, in_progress). Enforces no double-booking.
- Indexes: (professional_id, starts_at), (customer_id, starts_at), status, plus 0005 desc/partial variants.

**`booking_line_items`** (0001) — PK id; `booking_id` FK CASCADE, `kind` (service|addon|fee|tax|discount|tip|upcharge), `label`, `amount_cents`, `metadata` jsonb.

**`booking_status_events`** (0001) — PK id; `booking_id` FK CASCADE, `status`, `actor_id` FK, `note`, created_at. Audit trail of transitions.

**`saved_payment_methods`** (0005_booking_engine) — PK id; `customer_id` FK, `stripe_payment_method_id`, `brand`, `last4`, `exp_month/year`, `is_default`. Unique (customer_id, stripe_payment_method_id).

**`disputes`** (0005_booking_engine) — PK id; `booking_id` FK CASCADE, `opened_by` FK, `reason`, `detail`, `status` (dispute_status), `resolution`, `resolved_by`, timestamps.

**`dispute_evidence`** (0006) — PK id; `dispute_id` FK CASCADE, `uploaded_by` FK, `url`, `kind` (photo|screenshot|document).

**`dispute_events`** (0006) — PK id; `dispute_id` FK CASCADE, `actor_id`, `action`, `note` — dispute timeline.

### 3.7 Payments / Earnings / Connect

**`payments`** (0001) — PK id; `booking_id` FK RESTRICT, `status` (payment_status), `amount_cents`, `currency`, `stripe_payment_intent_id` (unique), `stripe_charge_id`, timestamps.

**`refunds`** (0001) — PK id; `payment_id` FK RESTRICT, `booking_id` FK, `amount_cents`, `reason`, `stripe_refund_id` (unique), `issued_by`.

**`payout_records`** (0001) — PK id; `professional_id` FK RESTRICT, `booking_id` FK, `amount_cents`, `status` (payout_status), `stripe_transfer_id` (unique).

**`earnings_ledger`** (0009) — PK id; `professional_id` FK CASCADE, `booking_id` FK SET NULL, `kind` (earning|refund_adjustment|payout), `amount_cents` (signed), `status` (pending|available|paid), `available_at`. **Unique (booking_id, kind)** → idempotent ledger writes. Index (professional_id, status, created_at desc).

**`stripe_events`** (0009) — PK `id` (text, Stripe evt id), `type`, `processed_at`. Webhook dedupe / exactly-once. RLS on, server-only.

### 3.8 Reviews

**`reviews`** (0001, extended 0006) — PK id; `booking_id` (unique) FK, `customer_id` FK, `professional_id` FK, `rating` (1–5), `body`, `professional_response`, `is_published` (default true), timestamps. +0006 multi-dimension: `professionalism`, `communication`, `punctuality`, `cleanliness`, `accuracy` (each 1–5), `photo_urls` text[], `helpful_count`, `is_reported`. Index on professional_id where is_published.

### 3.9 Messaging

**`conversations`** (0001, extended 0005) — PK id; `booking_id` (unique) FK CASCADE, `last_message_at`. +0005: `is_unlocked` (false until payment).

**`conversation_members`** (0001) — PK (conversation_id, user_id).

**`messages`** (0001, extended 0005) — PK id; `conversation_id` FK CASCADE, `sender_id` FK, `body`, `attachment_url`, `read_at`. +0005: `flagged`, `blocked`, `redacted_body` (pre-payment contact-info guard). Index (conversation_id, created_at).

### 3.10 Notifications / Mobile

**`notifications`** (0001) — PK id; `user_id` FK CASCADE, `type` (notif_type), `title`, `body`, `data` jsonb, `read_at`. Index (user_id, read_at).

**`device_tokens`** (0010) — PK id; `user_id` FK CASCADE, `token`, `platform` (ios|android|web), `device_name`, `last_seen_at`. Unique (user_id, token).

**`notification_preferences`** (0010) — PK user_id; per-channel/type booleans (push/email/sms, booking_updates, messages, reminders, promotions, payout_updates).

### 3.11 Loyalty / Referrals / Campaigns / Promos / Analytics

**`promo_codes`** (0001) — PK id; `code` unique, `discount_type` (percent|fixed), `discount_value`, `max_redemptions`, `redemption_count`, window, `is_active`.
**`promo_redemptions`** (0001) — PK id; `promo_id` FK, `customer_id` FK, `booking_id` FK; unique (promo_id, customer_id).

**`loyalty_accounts`** (0008) — PK user_id; `points` (≥0), `lifetime_points`, `tier` (default bronze).
**`loyalty_transactions`** (0008) — PK id; `user_id` FK, `points_delta`, `reason` (earn_booking|milestone|birthday|redeem|referral), `booking_id` FK.
**`account_credits`** (0008) — PK id; `user_id` FK, `amount_cents` (signed), `reason`.

**`referral_codes`** (0008) — PK user_id; `code` unique, `kind` (customer|professional).
**`referrals`** (0008) — PK id; `referrer_id`/`referred_id` FKs, `code`, `kind`, `status` (pending|qualified|rewarded|rejected), `rewarded_at`; **unique (referred_id)** (a user can be referred once).

**`campaigns`** (0008) — PK id; `name`, `type` (coupon|seasonal|geo|abandoned_booking|influencer), `discount_type`, `discount_value`, `is_active`, window, `cities` text[], `min_subtotal_cents`, `ab_treatment_fraction`, `created_by`.
**`campaign_redemptions`** (0008) — PK id; `campaign_id` FK CASCADE, `user_id` FK, `booking_id` FK SET NULL, `discount_cents`.

**`analytics_events`** (0008) — PK bigint identity; `user_id` FK SET NULL, `event`, `props` jsonb. Indexes (event, created_at desc), (user_id, created_at desc).

### 3.12 Admin / Audit / Platform / Beta

**`admin_roles`** (0001) — PK user_id; `kind` (admin_role_kind), `granted_by`. **RLS on, no client policy = deny.**
**`audit_logs`** (0001, index 0006) — PK id; `actor_id`, `action`, `entity`, `entity_id`, `metadata` jsonb. **RLS on, no client policy = deny.** Indexes (actor_id, created_at), (entity, entity_id).
**`platform_settings`** (0009) — PK `key`; `value` jsonb, `updated_by`, `updated_at`. Seeded rows: `maintenance_mode`, `bookings_paused`, `payments_paused`, `beta`. Public read; writes via service role.
**`beta_access_codes`** (0009) — PK `code`; `note`, `max_uses`, `uses`, `is_active`. RLS on, server-validated only.
**`beta_invites`** (0009) — PK id; `email`, `code` FK, `user_id` FK, `redeemed_at`.

### 3.13 Storage Buckets (`supabase/storage-policies.sql`)

| Bucket | Public | Purpose |
|--------|--------|---------|
| `verification-documents` | **private** | IDs, licenses, insurance, selfies. Owner may write only under own `{uid}/` prefix; owner reads own; admins read all; no public read (reads via admin-minted signed URLs). |
| `portfolio` | public | Portfolio media. Public read; owner write/update/delete under own `{uid}/` prefix. |
| `avatars` | public | Created at **runtime** by `src/lib/account/avatar-actions.ts` (`ensureBucket`), not in this SQL. Public, 5 MB limit, jpeg/png/webp. |

Object policies use `storage.foldername(name)[1] = auth.uid()::text` to scope ownership by path prefix.

---

## 4. Functions & Triggers (`0002_functions.sql`, plus 0005/0007)

| Function | Kind | Purpose |
|----------|------|---------|
| `set_updated_at()` | trigger | Sets `updated_at = now()` on update; wired to profiles, customer/professional_profiles, verifications, services, bookings, payments, payout_records, reviews. |
| `is_admin(uid)` / `is_support_or_admin(uid)` | SQL, SECURITY DEFINER | Row-exists check against admin_roles; used throughout RLS. |
| `handle_new_user()` | trigger (after insert on auth.users), SEC DEFINER | Auto-creates `profiles` (role customer) + `customer_profiles` for every new auth user. |
| `prevent_role_escalation()` | trigger BEFORE UPDATE profiles | Only service_role/admin may change role; a customer may self-upgrade to professional only; else raises. |
| `refresh_professional_rating()` | trigger on reviews | Recomputes denormalized `rating_average`/`review_count` on the pro. |
| `enforce_review_eligibility()` | trigger BEFORE INSERT reviews | Rejects a review unless the customer has a matching **completed** booking with that pro. |
| `is_privileged_writer()` | SQL SEC DEFINER (0005_column_guards) | true for service_role or admin — shared predicate for column guards. |
| `guard_professional_profile_columns()` | trigger BEFORE UPDATE (0005) | Non-privileged users cannot change `is_active`, `is_verified`, `is_featured`, `take_rate_bps`. |
| `guard_booking_columns()` | trigger BEFORE UPDATE (0005) | Non-privileged users cannot mutate snapshotted pricing/currency/PI/policy, nor set status to confirmed/in_progress/completed/refunded/disputed (cancellation stays allowed). |
| `guard_review_columns()` | trigger BEFORE UPDATE (0005) | Publication state platform-only; a pro may only append `professional_response`; author may revise rating/body but not the response. |
| `create_booking(...)` | RPC, PL/pgSQL SEC DEFINER (0005) | Atomic booking creation. Authorizes caller = customer (or admin), inserts booking (catches `exclusion_violation` → raises `SLOT_TAKEN`), inserts line items + initial status event. EXECUTE granted only to `authenticated`, revoked from public. |
| `expire_stale_pending_bookings()` | routine (0007) | Cancels `pending_payment` bookings older than 30 min; logs status events. Cron `*/10 * * * *`. |
| `expire_verifications()` | routine (0007) | Flags expired approved verifications → `more_info_requested`, un-verifies the pro. Cron `0 3 * * *`. |
| `recompute_reliability()` | routine (0007) | Recomputes cancellation/completion rate + reliability_score from bookings. Cron `0 * * * *`. |

pg_cron schedules are registered only if the extension exists (guarded `do $$` block); otherwise jobs run via edge functions.

---

## 5. RLS Posture

RLS is enabled on **every** application table (0003 for core; each later migration enables it on its own new tables). The governing pattern:

- **Ownership by `auth.uid()`**: customer_profiles, addresses, favorites, saved_payment_methods, recently_viewed, notifications, privacy_settings, blocks, referral_codes, device_tokens, notification_preferences, review_helpful_votes — `for all using (auth.uid() = owner) with check (...)`.
- **Public read + owner write**: professional_profiles (public read gated on `is_active OR owner OR admin`), categories (active), services (active + active-pro, or owner/admin), service_addons, portfolio (not hidden + active pro, tightened in 0004), availability (tightened in 0005_column_guards to active-pro/owner/admin), campaigns (active or admin), platform_settings (public read).
- **Multi-party read** (booking parties + admin): bookings, booking_line_items, booking_status_events, payments, refunds, payout_records, disputes, dispute_evidence, dispute_events, earnings_ledger (pro or admin), loyalty/credits/referrals (owner or admin).
- **Insert-scoped**: bookings insert `check auth.uid() = customer_id`; reviews insert `customer_id = auth.uid()` (plus eligibility trigger); messages insert require sender = uid AND conversation membership; content_reports insert `reporter_id = auth.uid()`; analytics insert self-or-null.
- **Deny-by-default (RLS on, no client policy)** → reachable only via service-role: `admin_roles`, `audit_logs`, `fraud_flags`, `stripe_events`, `beta_access_codes`, and the write side of loyalty/earnings tables.
- **Column-level gap closed by triggers** (0005_column_guards): because RLS grants whole rows and PostgREST is exposed to the anon key, BEFORE-UPDATE triggers stop owners from PATCHing privileged columns (self-activate, self-verify, zero the fee, forge pricing, unpublish reviews). This is the security backstop behind the server actions.
- **Hardening in 0005_column_guards**: `avail rules/exc read` changed from `using(true)` to active-pro/owner/admin; `promo public read` replaced with admin-only read (anon could previously enumerate live codes).

Messaging enforces a **pre-payment gate**: `conversations.is_unlocked` flips true only on webhook payment success; the send action rejects contact-info before unlock.
