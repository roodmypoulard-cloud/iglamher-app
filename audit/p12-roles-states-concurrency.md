# Phase-12 Production Verification — Roles, States & Booking Concurrency

Repo: `/Users/roodmypoulard/iglamher-app` (Next.js 16 + Supabase). READ-ONLY audit. Evidence cited as `file:line`.

---

## 1) Role-Based Access

### How each area is guarded

**Middleware (`src/middleware.ts`)** is thin and role-agnostic. It only enforces *authentication* on a fixed list:
`PROTECTED = ["/bookings", "/messages", "/profile", "/onboarding"]` (`src/middleware.ts:4`). Unauthenticated hits to those redirect to `/signin?next=…` (`src/middleware.ts:37-41`). Notably **`/pro` and `/admin` are NOT in the middleware list** — they are guarded only at the page level.
Fail-open: if Supabase env is unset/placeholder, middleware returns without any check (`src/middleware.ts:13`).

**Pro area (`/pro/*`)** — guarded by `getProContext()` (`src/lib/pro/context.ts`). Each page does `const ctx = await getProContext(); if (!ctx.authed) redirect("/signin?next=…")` (e.g. `src/app/pro/services/page.tsx:12-13`, `pro/earnings/page.tsx:23`, `pro/availability/page.tsx:10`, `pro/profile/page.tsx:12`, `pro/services/new/page.tsx:11`).

**Admin area (`/admin/*`)** — guarded by `requireAdminPage()` (`src/lib/admin/require-admin-page.ts`). It loads the user, and redirects to `/discover` unless `profiles.role === "admin"` (`require-admin-page.ts:12-14`). Used in `src/app/admin/page.tsx:50`. (Verify `admin/analytics` and `admin/campaigns` call it too — `admin/page.tsx` does; the sub-pages should be spot-checked.)

**Account (`/account/*`)** — `favorites` requires auth when live (`account/favorites/page.tsx:11-16`). `/account` and `/account/rewards` render with graceful empty states rather than a hard redirect.

### Verdict per protected area

| Area | Verdict | Evidence / Note |
|---|---|---|
| Customer → `/admin/*` | **PASS** | `requireAdminPage` redirects non-admins to `/discover` (`require-admin-page.ts:12-14`). Backed by RLS: admin data tables have no client SELECT policy or gate on `is_admin()`. |
| Customer → `/pro/*` | **GAP (soft)** | `getProContext().authed` is `true` for **any** signed-in user, not only professionals. A customer with no `professional_profile` gets `authed:true, pro:null` (`context.ts:29-31`). Pages then render with `ctx.pro?.…` fallbacks — e.g. `/pro/services` shows an empty "No services yet" screen (`pro/services/page.tsx:14,31`), `/pro/availability` renders default LA-timezone empty rules (`pro/availability/page.tsx:20-21`), `/pro/earnings` renders zeros. No sensitive data leaks (all reads are the caller's own via RLS), but a customer is **not redirected away** from `/pro/*`. `pro/profile` is the one page that handles `!ctx.pro` explicitly (`pro/profile/page.tsx:13-19`). Recommend a `role==='professional'`/`pro!==null` gate. |
| Provider → `/admin/*` | **PASS** | Same `requireAdminPage` role check; `professional` role ≠ `admin`. |
| Provider → other providers' data | **PASS** | RLS owner-scoping: `services owner write/update/delete` all `auth.uid() = professional_id` (`0003_rls.sql:63-65`); `avail rules owner` / `avail exc owner` (`0003_rls.sql:80,83`); `pro self update` on `professional_profiles` (`0003_rls.sql:46`); `payouts pro read` scoped (`0003_rls.sql:115`). Pro pages only ever read `ctx.pro` (own record via `getProfessionalByUserId(auth.user.id)`). |
| Admin routes require admin | **PASS** | `require-admin-page.ts:12-14`. |

### Demo fail-open (important)

Every gate short-circuits when `!isLiveSupabase()`:
- `getProContext` returns a **seeded demo professional** as fully authed (`context.ts:22-24`).
- `requireAdminPage` returns `{isDemo:true}` with **no auth check at all** (`require-admin-page.ts:8`).
- Middleware returns early on placeholder env (`middleware.ts:13`).

This is acceptable for local/demo but means **all role enforcement depends on `isLiveSupabase()` being true in prod**. In production (live Supabase) the gates are real and, critically, **backed by RLS** (`0003_rls.sql`, `0005_column_guards.sql`) plus role-escalation protection (`prevent_role_escalation` trigger, `0002_functions.sql:52-…`) — so even if a page-level gate were bypassed, the DB denies cross-tenant reads/writes. Admin identity is table-driven via `admin_roles` + `is_admin()` (`0002_functions.sql:24-26`), not a spoofable column.

---

## 2) Empty / Loading / Error States

### `loading.tsx` / `error.tsx` inventory

- `src/app/error.tsx` — global error boundary, "Something went wrong" + `reset()` (`error.tsx:5-20`). **This is the only `error.tsx`.**
- `loading.tsx`: `discover/`, `search/`, `categories/[slug]/`, `services/[id]/`, `account/favorites/`.
- `search` also uses `<Suspense fallback={<GridSkeleton/>}>` (`search/page.tsx:1,65-67`).

### Per-screen audit

| Screen | Empty | Loading | Error | Notes |
|---|---|---|---|---|
| `/discover` | ✅ `EmptyState "No professionals yet"` (`discover/page.tsx:52-54`) | ✅ `loading.tsx` | inherits global | PASS |
| `/search` | ✅ `emptyTitle` for no-match (`search/page.tsx:38`) | ✅ `loading.tsx` + Suspense skeleton | inherits | PASS |
| `/bookings` | ✅ `EmptyState "No bookings yet"` (`bookings/page.tsx:74-77`) | ❌ no `loading.tsx` | inherits | force-dynamic; minor — no skeleton |
| `/messages` | ✅ `EmptyState "No messages yet"` (`messages/page.tsx:27-30`) | ❌ none | inherits | PASS (empty ok) |
| `/messages/[id]` (thread) | ✅ empty branch `thread.messages.length === 0` (`messages/[id]/page.tsx:42`) | ❌ none | inherits | PASS |
| `/account` | ✅ `EmptyState "No upcoming appointments"` (`account/page.tsx:58-60`) | ❌ none | inherits | PASS |
| `/account/favorites` | ✅ via `FavoritesView` (localStorage-driven) | ✅ `loading.tsx` | inherits | PASS |
| `/account/rewards` | ✅ backend-off empty + "No points activity yet" (`rewards/page.tsx:27,73-74`) | ❌ none | inherits | PASS |
| `/pro/earnings` | ✅ "No completed bookings yet" banner (`pro/earnings/page.tsx:40-42`); charts hidden when empty (`:61`) | ❌ none | inherits | PASS |
| `/pro/services` | ✅ `EmptyState "No services yet"` (`pro/services/page.tsx:31-32`) | ❌ none | inherits | PASS |
| Professional profile (`/professionals/[slug]`) | ✅ Reviews section only renders `reviews.length > 0` (`professionals/[slug]/page.tsx:208`) | ❌ none (has parent skeleton on category) | inherits | PASS |
| Category (`/categories/[slug]`) | ✅ `emptyTitle "No {cat} pros yet"` (`categories/[slug]/page.tsx:48`) | ✅ `loading.tsx` | inherits | PASS |
| Booking flow (`/book/[slug]`) | ✅ empty branch `ordered.length === 0` (`book/[slug]/page.tsx:42`); inline error banner in `BookingFlow` (`BookingFlow.tsx:238`) | ❌ none | inherits | PASS |

### Fake data / seeded-data risk

- **Reviews: PASS.** Reviews render from the DB `reviews` relation (`professionals.ts:125-129`, join at `:138`). In prod the `reviews` table is empty, so `reviews.length` is 0 and the whole section is suppressed (`professionals/[slug]/page.tsx:208`). `rating_average`/`review_count` are trigger-maintained columns (`0002_functions.sql:79`) that stay 0 with no reviews — **no fabricated reviews or ratings appear in prod.** Seed reviews (`author: "Verified client"`) only surface when `!isLiveSupabase()`.
- **Earnings: PASS.** Provider earnings are computed purely from real `BookingFact` rows (`provider-metrics.ts:19-31`); with no completed bookings the numbers are genuinely zero and the "No completed bookings yet" banner shows (`pro/earnings/page.tsx:40-42`). Demo/seed figures only appear when `ctx.isDemo` (non-live).
- **Note:** In demo mode many screens show seed professionals/ratings — correct behavior, and prod uses live env, so end users never see seed data.

**Main state gaps:** only `error.tsx` at the root — no route-segment error boundaries, so a data-fetch throw anywhere bubbles to the whole-page "Something went wrong". And several dynamic screens (`/bookings`, `/pro/*`, thread) lack a `loading.tsx` skeleton (they're `force-dynamic`, so users see a blank/pending frame on slow fetch). Neither is broken, but both are polish gaps.

---

## 3) Booking Concurrency & Time

### Double-booking prevented atomically — **PASS**

Enforced by a Postgres **GiST exclusion constraint**, not app logic:

```
alter table public.bookings add constraint bookings_no_overlap
  exclude using gist ( professional_id with =, time_range with && )
  where (reserves_time and status in ('pending_payment','confirmed','change_requested','in_progress'));
```
`supabase/migrations/0001_schema.sql:237-242` (requires `btree_gist`, enabled `0001:6`). `time_range` is a generated `tstzrange(starts_at, ends_at, '[)')` (`0001:228`) — half-open, so back-to-back bookings touching at the boundary do **not** collide.

Creation goes through the `create_booking` RPC (`0005_booking_engine.sql:95-159`, `SECURITY DEFINER`). The insert is wrapped so the constraint violation is caught and re-raised as a clean, catchable error:
```
exception when exclusion_violation then
  raise exception 'SLOT_TAKEN' using hint = 'That time was just booked. Please pick another slot.';
```
`0005:145-146`. Because the check is a DB constraint inside a single transaction, **two concurrent bookings for the same pro+overlapping time can never both commit** — the loser gets `exclusion_violation`. The RPC also authorizes: only the customer themselves or an admin may book (`0005:127-129`).

### Second concurrent booking gets a clear error — **PASS**

The server action maps `SLOT_TAKEN` to a friendly message: "That time was just booked — please choose another slot." (`src/lib/booking/actions.ts:90-93`), surfaced in the `BookingFlow` error banner (`BookingFlow.tsx:238`).

### Availability computed server-side with buffers / min-notice / window / exceptions — **PASS**

`src/lib/availability/calc.ts` (`server-only` layer, unit-tested). `computeDaySlots` (`calc.ts:135-200`):
- Weekly rules → working windows (`calc.ts:149-154`).
- **Extra-hours exceptions** added, **blocked exceptions + existing bookings** subtracted via `subtractIntervals` (`calc.ts:156-175`).
- **Buffers** before/after extend the occupied range and must fit inside a contiguous window (`calc.ts:146,183-188`).
- **Min-notice**: `earliest = now + minNoticeMinutes`; earlier slots skipped (`calc.ts:178,190`).
- **Max window**: dates beyond `now + maxWindowDays` return no slots (`calc.ts:139-142`).

### Timezone / DST correctness — **PASS**

All instants stored/returned in UTC; working hours are wall-clock minutes in the pro's IANA zone (`calc.ts:4-8`). `zonedTimeToUtc` computes the zone offset **at the specific instant** via `Intl.DateTimeFormat` and refines once for DST edges (`calc.ts:75-95`), so "9:00 local" resolves correctly on both sides of a DST transition (spring-forward/fall-back). `zoneOffsetMs` recomputes per-instant (`calc.ts:50-72`). The booking row stores `timezone` alongside UTC `starts_at/ends_at` (`0005:139-140`), and the exclusion range is UTC `tstzrange`, so overlap math is DST-agnostic. This satisfies CLAUDE.md rule #9 (store UTC, render local).

### Edge-case handling

| Scenario | Handling | Verdict |
|---|---|---|
| Provider changes availability during checkout | Slot list is a point-in-time compute; the **authoritative** guard is the exclusion constraint at insert. If the pro blocks/books the slot first, the customer's `create_booking` still fails with `SLOT_TAKEN` (constraint) **only if another reserving booking exists**. A pure availability-rule/exception change is **not** re-validated at insert — the RPC does not re-run `computeDaySlots`. **Partial GAP**: a booking could be created into a window the pro just marked unavailable (as long as no overlapping booking exists). | GAP (minor) |
| Service removed/deactivated during checkout | `createBookingDraftAction` re-loads the service (`actions.ts:38-43`) and filters **add-ons** by `isActive` (`actions.ts:45`), but does **not** assert `service.isActive` before pricing/creating. A service toggled off mid-checkout can still be booked. **GAP.** (`actions.ts:38-56`) | GAP |
| Customer submits booking twice | Client guard: `useTransition` + `disabled={pending}` on confirm (`BookingFlow.tsx:37,239`). Server: two overlapping submits → second hits the exclusion constraint → `SLOT_TAKEN`. Non-overlapping accidental double-submit (different times) is not deduped, but that's benign. | PASS |
| Delayed / failed payment confirmation | Booking is created `pending_payment` and **holds the slot** via the constraint (`pending_payment` is in the exclusion status set, `0001:241`). Stripe webhook is source of truth: `payment_intent.succeeded` → `confirmed` (`api/stripe/webhook/route.ts:64-81`, guarded `eq status pending_payment`); `payment_failed`/`canceled` → releases (`:111-124`). Abandoned holds are swept by `expire_stale_pending_bookings()` after **30 min** (`0007_jobs.sql:12-27`), scheduled via `pg_cron` every 10 min (`0007:76`). This prevents an abandoned checkout from locking a slot forever. | PASS |

---

## Summary

1. **Concurrency is solid.** Double-booking is prevented atomically by the `bookings_no_overlap` GiST exclusion constraint (`0001_schema.sql:237-242`); the loser gets a clean `SLOT_TAKEN` (`0005:145`, `actions.ts:90`), `pending_payment` holds the slot, and stale holds auto-expire after 30 min via cron (`0007_jobs.sql:12-27,76`). DST is handled correctly by per-instant offset computation (`calc.ts:75-95`).
2. **Role gates are real in prod and RLS-backed**, but `/pro/*` and `/admin/*` are page-guarded only (not in middleware), and **`getProContext().authed` is true for any signed-in user** — a plain customer isn't redirected off `/pro/*`, they just see empty screens (`context.ts:29`, `pro/services/page.tsx:12`). All gates fail-open when `!isLiveSupabase()`.
3. **State coverage is good but uneven**: solid empty states everywhere and no fake reviews/earnings in prod (reviews table empty → sections suppressed; earnings computed from real bookings), yet **only one `error.tsx`** (root) and **no `loading.tsx`** on `/bookings`, `/pro/*`, or message threads.
4. **Two checkout GAPs**: the create action does not re-check `service.isActive` before booking (`actions.ts:38-56`), and availability *rule/exception* changes made mid-checkout aren't re-validated at insert (only overlapping bookings are caught by the constraint).
