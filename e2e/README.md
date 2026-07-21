# e2e — Playwright smoke tests

## What these cover, and what they deliberately do not

The app selects its data source at runtime via `isLiveSupabase()`
(`src/lib/data/source.ts`). When `NEXT_PUBLIC_SUPABASE_URL` is a placeholder —
which is the current state of `.env.local` — every page renders from
`src/lib/data/seed.ts` and the auth gates are intentionally relaxed so the UI
can be developed locally:

- `/account/favorites` renders an empty state instead of redirecting to `/signin`
- `/pro/*` renders a demo professional instead of requiring a session

**Consequence: these smoke tests exercise rendering, navigation, form
validation and the redirect-target hardening — they do NOT prove that
authentication or authorization works.** No test here signs a real user in,
because no real identity provider is configured.

The specs marked `test.describe.skip` under `authenticated` are written against
a live Supabase project and will run once one is configured. Until then, the
auth/RLS layer is covered only by the SQL guards in
`supabase/migrations/0005_column_guards.sql`, which are themselves unexecuted.

## Running

```bash
npm run test:e2e            # headless, boots its own dev server on :3100
npm run test:e2e -- --ui    # interactive
```

Against a live project:

```bash
E2E_BASE_URL=https://your-deploy npm run test:e2e
```
