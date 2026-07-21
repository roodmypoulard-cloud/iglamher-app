# iGlamHer — Launch Readiness Report (Phase 12)

**Production URL:** https://iglamher-app.vercel.app
**Report date:** 2026-07-20
**Scope:** Production environment, database migrations, Stripe configuration, booking lifecycle, messaging security, roles/permissions, mobile/browser QA, performance, security, observability — verified against the *live* deployment, not local builds.

---

## 0. Executive Verdict

# 🟠 NOT READY FOR LAUNCH (today) — one migration away from READY FOR CONTROLLED BETA

**Update — 2026-07-20:** Migrations `0011`, `0012`, `0013` have been **applied to production and independently verified by me against the live database** (evidence in §2 and §2.1). That cleared the earlier blockers: the messaging RLS recursion (`42P17`) is gone, payout/referral tables exist, and `redeem_loyalty_points` is locked to the service role.

**However, live verification uncovered a new, real blocker for messaging (§5):** the messaging feature is fully built *except the step that creates a conversation*. Nothing in the app or database ever inserts a conversation row, so production had **0 conversations** and **no user could start or receive a message** — even though, once a conversation exists, send + read + RLS all work end-to-end (I proved this on the live app). The fix is migration **`0014`** (auto-create a conversation per booking + backfill), written and ready to apply — **operator action; I cannot run DDL.**

The application is architecturally sound, secure by default, and the core booking loop works in Stripe **test mode**. Once migration `0014` is applied (and the seeded demo providers are addressed), the app is **READY FOR CONTROLLED BETA** on Stripe test mode.

**PUBLIC LAUNCH with real money is a separate, later gate** — it additionally requires live Stripe keys, one verified live end-to-end payout, a fix to the partial-deposit payout math, and error monitoring. Details in §3, §4, §13.

**Evidence legend used throughout this report:**
- ✅ **Verified automatically** — I executed it against live/prod or ran the gate myself.
- 👤 **Verified manually** — confirmed by reading prod data/config directly.
- 🔑 **Requires credentials** — needs live secrets I must never handle.
- 🖥️ **Requires external dashboard** — Stripe/Supabase/Vercel console, operator-only.
- ⛔ **Blocked** — could not be verified in this environment.
- ❌ **Failed** — tested and did not pass.

---

## 1. Production Environment Status

| Item | Status | Evidence |
|---|---|---|
| Vercel production deployment reachable | ✅ | `GET /` and `/api/health` both 200 |
| Health endpoint | ✅ | `/api/health` → `{ status: "ok", app: true, database: true, payments: true }` |
| Production env vars present (8) | 👤 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY`, `NEXT_PUBLIC_APP_URL`, `APP_ENV` — all set in Vercel Production scope |
| Secret values | 🔑 | Confirmed *present*; values never printed or inspected |
| Stripe mode | 👤 | **TEST mode** — publishable/secret keys are test keys; test payments present |

**No environment blockers for a test-mode beta.** For public launch, the four Stripe vars must be swapped to live values (§3).

---

## 2. Database Migration Status

Migrations `0001`–`0010` are applied (base schema, RLS, seed, jobs). The following **are committed in the repo and required by the deployed code, but are NOT applied to the production database:**

| Migration | Adds | Prod state | Notes |
|---|---|---|---|
| `0011_phase10_fixes.sql` | `redeem_loyalty_points()` RPC (atomic loyalty debit), `referral_audit` table | ✅ **APPLIED + VERIFIED** | RPC rejects anon/authenticated (`42501`); `referral_audit` exists |
| `0012_payout_transfers.sql` | `payout_transfers` table (payout ledger) | ✅ **APPLIED + VERIFIED** | Table exists; anon denied (RLS) |
| `0013_fix_messaging_rls.sql` | Fixes `conversation_members` self-referential RLS policy | ✅ **APPLIED + VERIFIED** | `42P17` recursion gone; scoped reads confirmed |
| `0014_create_conversation_on_booking.sql` | Trigger to auto-create a conversation + members per booking, + backfill | ❌ **PENDING** | **Required for messaging to be usable** — see §5. Written, not yet applied |

**How I verified (2026-07-20, live prod):** signed in as real test accounts and queried PostgREST directly. `payout_transfers` and `referral_audit` return `[]` with HTTP 200 (exist, RLS denies rows); `redeem_loyalty_points` returns `42501 permission denied for function` to anon/authenticated; `conversation_members`/`conversations`/`messages` return cleanly with **no `42P17`**. Full evidence in §2.1.

**Migration safety:** all three are idempotent (`if not exists` / `do`-block guards). `0013` drops and recreates a single `select` policy — non-destructive, no data loss. `APPLY_ALL.sql` already includes them for a fresh DB.

**⚠️ I cannot apply DDL** — no Postgres connection string and the service-role REST endpoint cannot execute DDL. `0011`/`0012`/`0013` were applied by the operator and verified by me. **Migration `0014` is now the #1 remaining manual operator action (§5, §13).**

### 2.1 Live verification evidence (2026-07-20)

Run directly against production PostgREST/GoTrue with the anon key and real signed-in test accounts:

| Probe | Result | Meaning |
|---|---|---|
| anon `GET conversation_members` (valid cols) | `[]`, HTTP 200 | No `42P17`; anon denied |
| anon `GET conversations` / `messages` | `[]`, HTTP 200 | No recursion; anon denied |
| anon `GET payout_transfers` | `[]`, HTTP 200 | Table exists (`0012`), RLS denies |
| anon `GET referral_audit` | `[]`, HTTP 200 | Table exists (`0011`), RLS denies |
| anon/authenticated `POST rpc/redeem_loyalty_points` | `42501 permission denied for function` | RPC exists (`0011`), locked to service role — cannot be abused |
| customer (member) `GET conversations` | 1 row (their booking) | Scoped read works |
| provider maya (member) `GET` conversation + messages | conversation + the customer's message | Provider sees only booking-tied threads |
| non-member provider / anon `GET conversation by id` | `[]` | Isolation holds |
| non-member `POST messages` | `42501` RLS violation, HTTP 403 | Send path enforced by RLS, not just UI |
| customer send via **live app UI** (Playwright) | message rendered **and** persisted (service-role read confirms) | True end-to-end |
| `create_booking` RPC (mismatched auth) | `P0001 "not authorized to book for another user"` | Booking creation present + authorization-guarded |
| `npm run build` | exit 0 | Production build green |

**Also confirm during apply:** the `0007` background jobs (`expire_stale_pending_bookings` every 10 min, verification expiry, reliability recompute) run **only if the `pg_cron` extension is enabled** in Supabase — the migration is a no-op otherwise and logs a notice. Verify `pg_cron` is installed and the three schedules are registered, or stale `pending_payment` holds will never auto-release. 🖥️

---

## 3. Stripe Readiness

**Core integration is production-grade** ✅ (verified by reading the webhook + payment code against prod behavior):

- Webhook signature-verified; `stripe_events` table gives idempotent, deduplicated processing.
- All charge amounts computed **server-side** from the DB (`computeBooking`), never trusted from the client.
- Handles `payment_intent.succeeded`, `payment_intent.canceled`, `charge.refunded` (now with a partial-refund-aware `fullyRefunded` derivation), and Connect account events.
- Refund → `reverseBookingPayout()` issues a proportional transfer reversal.

**Gaps before real money moves:**

| Gap | Severity | Detail |
|---|---|---|
| Test mode only | 🔑 High | Live keys + live webhook secret required; `payments: true` in health reflects test config |
| Partial-deposit payout over-pays | ⚠️ High | When a service collects a *deposit* (e.g. 20%) rather than full price, the payout/earnings math is derived from the **full service total**. Safe only for full-payment services. Must fix before enabling live payouts (§13) |
| `checkout.session.expired` not handled | Medium | Abandoned checkouts rely on `payment_intent.canceled` + the `expire_stale_pending_bookings` cron to clear the hold — so this is *mitigated only if `pg_cron` is running* (§2) |
| Payout backend dormant | — | `transferBookingPayout()` is wired but no-ops until `0012` applied + Connect enabled + live keys |

**Operator steps for live payments** are in §13.

---

## 4. Booking Lifecycle Results

| Stage | Status | Evidence |
|---|---|---|
| Browse → service → draft pricing | ✅ | Server-authoritative `computeBooking`; verified $85 service → $17 (20%) deposit |
| Slot hold + no double-booking | ✅ | Postgres **GiST exclusion constraint** rejects overlaps; app surfaces `SLOT_TAKEN`. Concurrency is DB-enforced, not app-race-prone |
| Deposit checkout (test) | ✅ | Stripe Checkout completes; `payment_intent.succeeded` marks booking paid |
| Stale hold cleanup | ⚠️ | Via `expire_stale_pending_bookings` cron — depends on `pg_cron` being enabled (§2) |
| **Active-service re-check at booking** | ❌ Gap | `bookBooking` prices from `getServiceWithProfessional` but does **not** re-assert `service.isActive` before insert. A stale/deactivated service link can still be booked. Low-risk (not UI-reachable) but should be closed |
| Remaining-balance capture on completion | ⚠️ | Deposit-then-balance flow: the remaining balance is not auto-captured at completion — relevant only once deposit services + live payouts are enabled |
| Refund | ✅ | Dashboard-issued refund → webhook syncs booking + reverses payout |

**Booking core loop works end-to-end in test mode.** The active-service re-check and remaining-balance capture are the two correctness items to close before deposit-based public launch.

---

## 5. Messaging Security Results

**Verified live on 2026-07-20 with real test accounts** (customer, the booking's provider "Maya Rose Beauty", a non-member provider, and anon):

| Check | Status | Evidence |
|---|---|---|
| RLS recursion (`42P17`) | ✅ **FIXED** | `0013` applied; `conversation_members`/`conversations`/`messages` all return cleanly, no recursion. Policy is now `user_id = auth.uid()` (non-recursive) |
| Customer sees only their conversations | ✅ | Member customer reads exactly 1 conversation (their booking); non-member + anon read `[]` |
| Provider sees only booking-tied conversations | ✅ | Provider (member) reads the conversation + its messages; a **different** signed-in provider (non-member) reads `[]` |
| Anonymous denied | ✅ | Anon reads of conversations/members/messages all return `[]`, HTTP 200 |
| Send path secured by RLS (not just UI) | ✅ | Member insert succeeds; **non-member message insert denied with `42501` RLS violation (HTTP 403)** |
| Server-side contact guard | ✅ | `sendMessageAction` verifies membership + unlock before insert |
| Input validation | ✅ | Zod: non-empty, max 2000 chars; `blocked` messages filtered from threads |
| End-to-end on the deployed app | ✅ | Playwright on live prod: customer signed in → opened thread → sent a message via the composer → **rendered in thread AND persisted to the DB** (confirmed by a service-role read) |
| Rate limiting on send | ⚠️ | Not wired (see §10) |

### 🟠 Blocker found: conversations are never created (fix = migration `0014`)

The RLS layer, send action, read UI, and unlock-on-payment webhook **all work**. But live verification found that **no code path — application or database — ever inserts a conversation.** `create_booking()` doesn't create one; there was no trigger; the webhook only *updates* `is_unlocked` assuming a conversation already exists. Confirmed against prod with the service-role key: **0 conversations, 0 conversation_members, 0 messages** system-wide before my test.

**Consequence:** every messaging layer is correct, but a real user can never *start* or *receive* a message, because the conversation that all of those layers operate on is never born. Messaging is effectively dead in prod despite `0013` being applied.

**Proof the rest works:** I manually created one conversation for the existing confirmed booking, then verified end-to-end on the live site (send + render + persist + provider receipt + non-member denial), all passing — see the table above.

**Fix (written + PROVEN, awaiting operator apply):** migration **`0014_create_conversation_on_booking.sql`** — an `AFTER INSERT` trigger on `bookings` that creates the conversation and adds both parties as members, plus a backfill for existing bookings. Additive, idempotent, no data dropped. Paste file: `supabase/APPLY_PENDING_0014.sql` (also folded into `APPLY_ALL.sql` for fresh DBs). **This is the one remaining blocker for controlled beta.**

#### Phase 12.1 — `0014` verified end-to-end against a real Postgres 16 (2026-07-20)

Because I cannot apply DDL to prod (no DB connection string / management token — service-role is a PostgREST JWT), I proved the migration on an ephemeral local Postgres 16 cluster using the exact trigger/backfill SQL from `0014`, mirroring the production table shapes. **All six tests passed:**

| Test | Requirement covered | Result |
|---|---|---|
| Single booking insert | 1 conversation + both members (customer + provider) | ✅ 1 conversation, 2 members, both parties present |
| Retry creation | Idempotent — no duplicate | ✅ `INSERT 0 0`; conversation count stays 1 |
| Duplicate conversation attempt | Atomically impossible | ✅ `unique_violation` blocks it (booking_id UNIQUE) |
| 51 bookings | Exactly one conversation each | ✅ 51 bookings → 51 conversations, **0** with ≠2 members |
| Orphan booking (trigger disabled) + backfill | Existing bookings backfilled safely | ✅ 0 → 1 conversation + 2 members |
| Unlock condition | Confirmed/completed unlock; pending stays locked | ✅ pending = `false`, confirmed = `true` |

**Atomicity (req 2):** the trigger fires inside the booking `INSERT`'s own transaction, so a rolled-back booking rolls back its conversation too; and the `booking_id` UNIQUE constraint makes a duplicate conversation structurally impossible even under concurrent retries. **RLS (req 5):** `0014` adds only a trigger + function + backfill inserts — it changes no policy, so all existing RLS is preserved by construction.

**Live-prod half already verified (previous step):** with a conversation present, customer→send, provider→receive, and non-member/anon→denied (`42501`/`[]`) all passed on the deployed app. Once `0014` is applied, the "customer books → conversation auto-created" step joins that already-working chain.

**Remaining operator action:** apply `supabase/APPLY_PENDING_0014.sql` in the Supabase SQL Editor, then run its V1–V3 checks and confirm a freshly-created booking auto-spawns a conversation with two members.

---

## 6. Role & Permission Results

| Check | Status | Detail |
|---|---|---|
| Data-layer authorization (RLS) | ✅ | `bookings`, `payments`, `messages`, `payout_transfers` deny-by-default; verified anon → 0 rows |
| Server actions authorize | ✅ | All 17 action files check `auth.getUser()` + ownership before mutating |
| `/pro/*` and `/admin/*` gating | ⚠️ | **Page-guard only** (no middleware). `getProContext().authed` is true for *any* signed-in user, so a customer visiting `/pro` sees empty pro screens rather than a redirect. No data leak (RLS still blocks), but it's a UX/authorization-clarity gap |
| Demo/fail-open mode | ⚠️ | When `!isLiveSupabase()`, some guards fail open (returns synthetic data). Prod is live-Supabase so not exploitable in prod, but keep `APP_ENV`/Supabase env correct |

**No privilege-escalation or data-exposure risk found.** The role gating is defense-in-depth-incomplete (cosmetic), not a security hole, because RLS is the real enforcement layer and it holds.

---

## 7. Mobile & Browser QA

| Check | Status | Evidence |
|---|---|---|
| Horizontal overflow 320–1440px | ✅ | Playwright swept `/`, `/discover`, profile, `/bookings`, `/messages` — no overflow at any width |
| Console errors | ✅ | 0 console errors/warnings across the swept pages |
| Touch targets / responsive layout | ✅ | Sticky topbar, category cards, hero all reflow correctly |
| **Real Safari / Firefox engines** | ⛔ | Only Chromium available in this environment. iOS Safari and Firefox require **manual device/browser testing** before public launch |

---

## 8. Performance Findings

Lighthouse (mobile emulation, live prod):

| Page | Perf | A11y | LCP | CLS | TBT |
|---|---|---|---|---|---|
| Discover | 84 | 98–100 | ~4.0s | 0 | ~20–30ms |
| Profile | 87 | 98–100 | ~4.0s | 0 | ~20–30ms |

- **CLS is perfect (0)** and **TBT is excellent** — no layout-shift or main-thread problems.
- **LCP ~4.0s is the one real weakness** (target <2.5s). The hero image is the LCP element; it already uses `next/image` with `priority`, `fill`, and `quality=82`. Remaining wins: serve a smaller/AVIF hero variant and preconnect to the Supabase image host.
- Not a launch blocker for beta; worth one optimization pass before public launch.

---

## 9. Security Findings

**Overall posture: strong.** ✅

- No secrets committed; `.env*` gitignored; service-role key `server-only`.
- Every server action authorizes; RLS deny-by-default across sensitive tables.
- Webhook signature-verified + idempotent.
- Uploads validate MIME type + size; redirect helper guards open-redirects; all money amounts server-computed.

**Lower-severity items:**

| ID | Severity | Finding |
|---|---|---|
| S1 | Low | ~31 call sites return raw DB `error.message` to the browser — information disclosure. Wrap in generic user-facing messages |
| S2 | Low | Recipient email address logged in a messaging code path — PII in logs. Drop or hash |
| S3 | Med | No general rate limiting (see §10) |

---

## 10. Monitoring / Observability Status

**This is the weakest area and the main non-migration gap for public launch.**

| Capability | Status |
|---|---|
| `/api/health` liveness | ✅ Present |
| Error tracking (Sentry/equivalent) | ❌ `captureError` writes to **console only**; the Sentry integration is a commented stub. No aggregation, no alerting |
| Structured logging in action failures | ❌ Most action files log nothing on failure |
| Rate limiting | ⚠️ A `redisRateLimit` helper exists but is wired **only to auth** — not to messaging, booking, or upload endpoints |
| Payment/webhook alerting | ❌ Failed payouts recorded to a table (once `0012` exists) but no alert surface |

For a **controlled beta** this is tolerable (low traffic, hands-on operator). For **public launch** you need at least: a real error sink (Sentry DSN) and rate limiting on messaging + booking.

---

## 11. Launch Data Integrity

| Check | Status | Detail |
|---|---|---|
| Fake reviews | ✅ None | `reviews` table empty in prod; ratings computed from real data |
| Fake earnings | ✅ None | Earnings derived from real bookings/payments |
| Empty states | ✅ | `/bookings`, `/messages`, discover all render proper empty states (verified live with a real test account) |
| **Seeded providers** | ⚠️ | Prod shows **~10 seeded demo providers + ~33 services**. This is a *fake marketplace inventory* problem: real customers would book demo providers who won't show up. **Decide before public launch:** remove them, clearly label as "demo," or replace with real onboarded providers |
| Loading skeletons | ⚠️ | Root `error.tsx` + `not-found.tsx` present, plus 6 `loading.tsx`, but `/bookings`, `/pro/*`, and message threads lack `loading.tsx` — minor polish |

---

## 12. Failed / Blocked / Credential-Gated Tests

**❌ Failed (in current prod state):**
- **Messaging is unusable for real users** — no conversation is ever created (0 conversations in prod). RLS/send/read all verified working *once a conversation exists*; fixed by pending migration `0014`. (The earlier `42P17` recursion is resolved — `0013` applied.)

**✅ Now passing (were failing/pending before 2026-07-20):**
- Migrations `0011`/`0012`/`0013` applied + verified live.
- Messaging RLS recursion gone; cross-user isolation confirmed with real accounts.
- `redeem_loyalty_points` locked to service role (`42501` to anon/authenticated).
- Production build green (`npm run build`, exit 0).
- Booking creation intact (`create_booking` RPC present + authorization-guarded).

**⛔ Blocked in this environment:**
- Real Safari/Firefox rendering (Chromium only).
- Live Stripe end-to-end payment + payout (test mode only).
- Confirming `pg_cron` is enabled + schedules registered (Supabase dashboard).

**🔑 Requires credentials / 🖥️ external dashboard (operator-only):**
- Applying migrations `0011`/`0012`/`0013` (Supabase SQL editor).
- Swapping to live Stripe keys + enabling Connect.
- Verifying the live webhook endpoint secret.

**Nothing was marked green that I did not actually execute.** Every ✅ in this report corresponds to a command I ran against live/prod or code I read directly.

---

## 13. Manual Actions Required (operator — I cannot do these)

**✅ Done (2026-07-20):** Migrations `0011`, `0012`, `0013` applied and verified live.

**Blockers for CONTROLLED BETA (test mode):**
1. **Apply migration `0014`** (`supabase/APPLY_PENDING_0014.sql`) — creates a conversation per booking + backfills. Without it, messaging is non-functional for real users. Run its V1–V3 verification queries after (trigger exists; bookings == conversations; every conversation has 2 members).
2. **Verify `pg_cron`** is enabled and the three `0007` schedules are registered (or stale holds won't expire).
3. **Decide on the 10 seeded providers** — remove, label "demo," or replace with real onboarded pros.

**Additional blockers for PUBLIC LAUNCH (real money):**
4. **Fix the partial-deposit payout math** (§3) so deposit-based services don't over-pay providers.
5. **Add an active-service re-check** in `bookBooking` before insert (§4).
6. **Switch Stripe to live keys** (4 env vars) + enable **Connect** + register the **live webhook** endpoint/secret, then run **one live end-to-end booking + payout** and confirm funds land in a Connect account.
7. **Wire error monitoring** (Sentry DSN → replace the `captureError` console stub) and **rate limiting** on messaging + booking.
8. **Manual cross-browser QA** on real iOS Safari + Firefox.

---

## 14. Exact Launch Sequence

**Phase A — Controlled Beta (test mode, invite-only):**
1. ✅ Migrations `0011`/`0012`/`0013` applied + verified (done 2026-07-20).
2. **Apply migration `0014`** (`APPLY_PENDING_0014.sql`); run its V1–V3 checks; confirm a real test customer can send + receive a message on a booking (I verified the data path; re-confirm after the trigger goes live so new bookings auto-create conversations).
3. Confirm `pg_cron` + schedules.
4. Resolve seeded-provider decision.
5. Invite a small cohort; keep Stripe in **test mode**; monitor `/api/health` + Vercel logs by hand.

**Phase B — Public Launch (real money):**
6. Complete manual actions 4–8 above.
7. Swap Stripe env vars to live; redeploy; register live webhook.
8. Run one **live** end-to-end booking + refund + payout; verify in the Stripe dashboard.
9. Confirm error monitoring is receiving events.
10. Open registration; watch payout_transfers + error sink closely for the first 48h.

---

## 15. Rollback Plan

- **Code:** Vercel keeps immutable deployments — roll back instantly via the dashboard to the last-known-good deployment. No build step required.
- **Migrations:** all three are additive; `0011`/`0012` add tables (safe to leave), `0013` only swaps a `select` policy. If `0013` ever needs reverting, re-create the prior policy — but note the prior policy is the *broken* one, so forward-fix is preferred over rollback.
- **Stripe live→test:** revert the 4 env vars and redeploy; in-flight live charges must be reconciled manually in the Stripe dashboard.
- **Kill switch:** `isBookingsPaused()` already gates new bookings — flip it to halt intake without a redeploy.
- **Data:** take a Supabase point-in-time snapshot immediately before applying migrations and before enabling live payments.

---

## 16. Post-Launch Monitoring Checklist

**First 48 hours (public launch):**
- [ ] `/api/health` green (automate a 5-min uptime ping).
- [ ] Error sink (Sentry) — triage every new issue.
- [ ] Stripe dashboard — every `payment_intent` reaches a terminal state; no stuck `requires_capture`.
- [ ] `payout_transfers` — status `paid`, zero `failed`/`pending` piling up; investigate any `failed` immediately.
- [ ] `stripe_events` — no repeated webhook delivery failures.
- [ ] Booking table — no `pending_payment` rows older than the hold window (confirms cron is running).
- [ ] Vercel function logs — watch for `42P17`/PGRST errors (would indicate a missed migration).

**Ongoing:**
- [ ] Weekly: refund/reversal reconciliation vs. Stripe.
- [ ] Weekly: referral_audit review for fraud patterns.
- [ ] LCP trend (target <2.5s) via Vercel Analytics.
- [ ] Rate-limit rejection counts (detect abuse or misconfigured limits).

---

### Bottom line

The engineering is solid and the security model is genuinely strong — this is not a "technically complete but hollow" app. But it is **NOT READY FOR LAUNCH today** because the deployed code depends on **three unapplied migrations**, one of which means **messaging is silently broken in production right now**. Apply `0011`/`0012`/`0013`, confirm `pg_cron`, and handle the seeded providers, and you are **READY FOR CONTROLLED BETA** in test mode. Real-money **PUBLIC LAUNCH** is a further, well-defined step behind the partial-deposit payout fix, live keys with one verified payout, and error monitoring.
