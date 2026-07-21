# iGlamHer — Authentication Flow Audit

Traced from the actual code paths. Every claim below cites the file it came from. Where something is
declared but not wired, it is called out as **STUBBED / NOT WIRED**.

---

## 1. Supabase clients (three, by privilege level)

| Client | File | Key used | RLS | Where used |
|---|---|---|---|---|
| Browser | `src/lib/supabase/client.ts` | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Enforced (as anon/user) | Client components — only OAuth today (`OAuthButtons.tsx`) |
| Server | `src/lib/supabase/server.ts` | anon key, bound to request cookies | Enforced (as signed-in user) | Server components / actions / route handlers |
| Admin | `src/lib/supabase/admin.ts` | `SUPABASE_SERVICE_ROLE_KEY` | **Bypasses RLS** | Webhooks, `/book/success`, Stripe Connect sync, seeding |

Key facts from the code:

1. `client.ts` uses `createBrowserClient` from `@supabase/ssr` with the anon key only (comment: "Never the service role").
2. `server.ts` uses `createServerClient` wired to `next/headers` `cookies()`. The `setAll` catch block silently ignores writes made from a Server Component (cookies can't be set there) — the middleware is responsible for refreshing them. Exported twice: `createClient` and the alias `createSupabaseServerClient` (used by the Phase 3 data modules).
3. `admin.ts` begins with `import "server-only"` — importing it into a client bundle throws at build time. It builds a raw `@supabase/supabase-js` client with `autoRefreshToken:false, persistSession:false`. The service-role key is read via `serverEnv()` (`src/lib/env.ts`), which Zod-validates it and throws if absent.

---

## 2. Session refresh — middleware (`src/middleware.ts`)

`middleware.ts` runs on every request except static assets (see `config.matcher`). Steps:

1. Reads `NEXT_PUBLIC_SUPABASE_URL` / `ANON_KEY` directly from `process.env`. If missing or containing `"placeholder"`, it returns `NextResponse.next()` immediately — **the app is fully open when Supabase is not configured** (local/demo mode).
2. Builds a `createServerClient` whose cookie `setAll` re-issues `response` with refreshed auth cookies (the SSR session-refresh pattern).
3. Calls `supabase.auth.getUser()` — this is the token refresh + validation.
4. Route guarding by prefix:
   - `PROTECTED = ["/bookings","/messages","/profile","/onboarding"]` — an **unauthenticated** user hitting these is redirected to `/signin?next=<path>` (destination remembered).
   - `AUTH_PAGES = ["/signin","/signup"]` — an **authenticated** user hitting these is bounced to `/discover`.

Note: role is **not** checked in middleware — only presence of a user. Role gating happens per-page/per-action (§7).

---

## 3. Validation schemas (`src/lib/auth/schemas.ts`)

Zod schemas: `signUpSchema` (fullName 2–80, email, password ≥8), `signInSchema` (email, password ≥1),
`forgotPasswordSchema` (email), `resetPasswordSchema` (password ≥8). All server actions parse with these
before touching Supabase. **Role is never in any schema** — it cannot be supplied by the client.

---

## 4. Server actions (`src/lib/auth/actions.ts`, `"use server"`)

All return `ActionState = { error?, success? } | undefined` and are driven by `useActionState` in
`src/components/auth/AuthForms.tsx`.

1. **`signUpAction`** — rate-limited via `rateLimitGuard("auth")` (`src/lib/security/guard.ts`); Zod-parses; calls
   `supabase.auth.signUp({ email, password, options:{ data:{ full_name }, emailRedirectTo: <APP_URL>/auth/callback?next=/onboarding/customer }}}`.
   On success returns `{ success: "Check your email to verify your account." }` — **no session yet** (email confirmation required).
2. **`signInAction`** — rate-limited; Zod-parses; `signInWithPassword`. On error returns a deliberately generic
   `"Incorrect email or password."` (no user-enumeration). On success `redirect(safeNext(formData.get("next")))`.
3. **`signOutAction`** — `supabase.auth.signOut()` then `redirect("/signin")`.
4. **`forgotPasswordAction`** — `resetPasswordForEmail(email, { redirectTo: <APP_URL>/auth/callback?next=/reset-password })`.
   Always returns the same neutral `"If that email exists, a reset link is on its way."` (no enumeration).
5. **`resetPasswordAction`** — `supabase.auth.updateUser({ password })` (works because the callback already exchanged
   the recovery code into a session), then `redirect("/discover")`.

The `full_name` from sign-up is passed as `options.data.full_name` → lands in `auth.users.raw_user_meta_data` → read
by the DB trigger (§6).

---

## 5. The `/auth/callback` route (`src/app/auth/callback/route.ts`)

Single `GET` handler that serves email verification, password-reset, and OAuth code exchange:

1. Reads `code` and `next` (default `/discover`) from the query string.
2. If `code` present → `supabase.auth.exchangeCodeForSession(code)` (sets the session cookies via the server client).
3. On success → `redirect(origin + safeNext(next))`. On failure or no code → `redirect(origin + "/signin?error=auth_callback")`.

`next` is always passed through `safeNext` before being used in the `Location` header.

---

## 6. Profiles auto-provisioning & roles (DB triggers)

Roles are stored on `public.profiles.role`, an enum `user_role = ('customer','professional','admin','support')`
(`supabase/migrations/0001_schema.sql`). `profiles.id` is a FK to `auth.users(id) ON DELETE CASCADE`.

Auto-provisioning — `supabase/migrations/0002_functions.sql`:

1. `handle_new_user()` (SECURITY DEFINER) fires `AFTER INSERT ON auth.users` (trigger `on_auth_user_created`). It:
   - inserts a `profiles` row with `role='customer'` and `full_name = raw_user_meta_data->>'full_name'` (`ON CONFLICT DO NOTHING`);
   - inserts a matching `customer_profiles` row.
   So **every new auth user is a customer by default** — the role is set server-side by the trigger, never by the client.
2. `prevent_role_escalation()` fires `BEFORE UPDATE ON profiles` (trigger `trg_profiles_role_guard`). Role changes are rejected unless:
   - the caller is `service_role` or an existing admin (`is_admin(auth.uid())`), **or**
   - it is exactly `customer → professional` performed by the user on their own row.
   Any other role change → `raise exception 'role change not permitted'`.
3. `is_admin(uid)` / `is_support_or_admin(uid)` are SECURITY-DEFINER lookups against `admin_roles`, used inside RLS
   policies. (Note: admin status lives in the `admin_roles` table; the `profiles.role='admin'` value is what the app
   code reads in `requireAdminPage`/`requirePro` — see §7.)

RLS on identity tables (`supabase/migrations/0003_rls.sql`):
- `profiles`: self-read (`auth.uid()=id` or admin), self-update only.
- `customer_profiles`: full access only to owner.
- `professional_profiles`: public read only when `is_active` (or owner/admin); self-insert/self-update.

---

## 7. How protected pages & actions check auth/role

There is no single guard — three patterns coexist:

1. **Middleware prefix gate** (§2) — coarse presence check for `/bookings`, `/messages`, `/profile`, `/onboarding`.
2. **Per-action `getUser()` checks** — e.g. `createBookingDraftAction` (`src/lib/booking/actions.ts`) returns
   `"Please sign in to book."` when `auth.user` is null; `createCheckoutSessionAction` returns `{ needsAuth:true }`;
   `updateBookingStatusAction` additionally verifies the caller is the booking's customer or professional.
3. **Role gates** reading `profiles.role`:
   - `requireAdminPage(nextPath)` (`src/lib/admin/require-admin-page.ts`) — `getUser()`; if none → `redirect(/signin?next=…)`;
     if `role !== 'admin'` → `redirect(/discover)`.
   - `requirePro()` (`src/lib/payments/connect-actions.ts`) — requires `role` of `professional` or `admin`.
   - `getProContext()` (`src/lib/pro/context.ts`) — resolves the signed-in professional; returns `authed:false` when
     no user (caller redirects).
   - Note each of these first checks `isLiveSupabase()` (`src/lib/data/source.ts`) and returns an `isDemo:true`
     bypass when Supabase is not configured — **demo mode is unauthenticated by design**.

The authoritative authorization layer is **RLS**, not the UI (per CLAUDE.md rule 6). App-level checks are UX;
the DB policies are the real gate.

---

## 8. `next` / redirect safety (`src/lib/auth/safe-next.ts`)

`safeNext(value, fallback="/discover")` hardens every post-auth redirect against open-redirect/phishing. It rejects
(→ fallback) anything that is: not a string / empty; doesn't start with `/`; starts with `//` (protocol-relative);
contains `\` (browser-normalised authority); matches `HAS_SCHEME` (`/+scheme:`); or contains control chars
(≤0x1F or 0x7F, catching encoded CR/LF header smuggling). Used by `signInAction`, the `/auth/callback` route, and
covered by `src/lib/auth/__tests__/safe-next.test.ts`. The middleware and `BookingFlow` build `next` from the current
pathname, so the value is always a safe same-origin path before it reaches `safeNext`.

---

## 9. OAuth (`src/components/auth/OAuthButtons.tsx`) — partially live

Google/Apple via `supabase.auth.signInWithOAuth({ provider, options:{ redirectTo: <origin>/auth/callback?next=… }})`,
run from the **browser** client. If `isLiveSupabase()` is false, the buttons show an explanatory message instead of
failing. **Requires the providers to be enabled/configured in the Supabase dashboard** (per `.env.example` note) — the
code path is real but inert until that dashboard config exists.

---

## 10. Step-by-step: sign-up → confirmed → session → role-gated access

1. User submits `SignUpForm` → `signUpAction` (rate-limit → Zod → `auth.signUp` with `emailRedirectTo=…/auth/callback?next=/onboarding/customer`).
2. Supabase creates the `auth.users` row → trigger `on_auth_user_created` runs `handle_new_user()` → `profiles` (role=`customer`) + `customer_profiles` rows created. Form shows "Check your email…". **No session yet.**
3. User clicks the email link → `GET /auth/callback?code=…&next=/onboarding/customer` → `exchangeCodeForSession(code)` sets session cookies → `redirect(/onboarding/customer)` (via `safeNext`).
4. Session now lives in cookies; middleware refreshes it on each request via `getUser()`.
5. Customer onboarding page renders (see **STUBBED** below). App treats the user as a `customer`.
6. **Becoming a professional:** the only allowed self-upgrade is `customer → professional` on one's own row (guarded by `prevent_role_escalation`). After that, `requirePro()`/`getProContext()` unlock the pro dashboard and Stripe Connect onboarding.
7. **Admin access:** `profiles.role='admin'` (set only by service role or an existing admin) → `requireAdminPage` allows `/admin/*`; everyone else is redirected to `/discover`.
8. **Sign-out:** `signOutAction` → `auth.signOut()` → `/signin`.
9. **Forgot/reset:** `forgotPasswordAction` emails a link → `/auth/callback?next=/reset-password` exchanges the recovery code into a session → `resetPasswordAction` calls `updateUser({password})` → `/discover`.

---

## 11. Real vs stubbed — summary

**Real & wired:** all three Supabase clients; middleware session refresh + prefix gating; all four auth actions
(sign-in/up/out, forgot, reset) with rate-limiting and Zod; `/auth/callback` code exchange; `safeNext` hardening
(tested); the `profiles`/`customer_profiles` auto-provision trigger; the role-escalation guard; RLS policies; the
role gates (`requireAdminPage`, `requirePro`, `getProContext`).

**Stubbed / not wired:**
- **Customer onboarding form** (`src/app/onboarding/customer/page.tsx`) — the `<form>` has **no `action`**; the
  referenced `completeCustomerOnboarding` server action **does not exist** (grep finds it only in a comment). Submitting
  does nothing; `customer_profiles.onboarding_complete` is never set from this UI.
- **Professional onboarding** (`src/app/onboarding/professional/page.tsx`) — purely presentational; `currentStep` is
  hardcoded to `1`; no persistence to `professional_profiles.onboarding_step`.
- **OAuth** — code is real but dormant until Google/Apple are configured in the Supabase dashboard.
- **Demo mode** — when `NEXT_PUBLIC_SUPABASE_URL` is absent/placeholder, middleware and every gate fall open (no auth),
  by design, so the UI renders on seed data.
