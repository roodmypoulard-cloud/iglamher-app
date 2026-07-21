# iGlamHer

Luxury beauty-services marketplace — Next.js 16 (App Router), TypeScript (strict), Tailwind v4,
Supabase (Auth/DB/Storage/RLS). Design system: "Soft Luxe" (rose-gold on near-black, editorial serif).

## Setup

```bash
npm install
cp .env.example .env.local   # fill in Supabase keys (see below)
npm run dev                  # http://localhost:3000
```

Without a Supabase project the app runs in **seed mode**: pages render from the deterministic
dataset in `src/lib/data/seed.ts`. Mutations (favorites, service edits, availability) require a
connected database.

## Environment

```
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...      # server-only, never commit
```

## Database

Apply migrations in order in the Supabase SQL editor, then the categories seed:

```
supabase/migrations/0001_schema.sql
supabase/migrations/0002_functions.sql
supabase/migrations/0003_rls.sql
supabase/migrations/0004_marketplace.sql
supabase/seed.sql
```

Enable the `pg_trgm`, `btree_gist`, and `postgis` extensions (the migrations create them; some
hosted projects require enabling them in Database → Extensions first).

Then seed test accounts + the 12-professional marketplace via the Auth admin API:

```bash
NEXT_PUBLIC_SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npm run db:seed
```

Test logins (password `Passw0rd!test`): `customer@iglamher.test`, `pro@iglamher.test`,
`admin@iglamher.test`, plus `<slug>@pro.iglamher.test` for each seeded professional.

## Scripts

```bash
npm run dev         # dev server
npm run build       # production build
npm run typecheck   # tsc --noEmit
npm run lint        # eslint
npm test            # vitest (unit)
npm run db:seed     # seed Supabase (needs real keys)
npx playwright test # e2e smoke (builds + starts on :3100)
```

## Architecture notes

- **Search**: DB-indexed retrieval (trigram + FTS in `0004`) re-ranked in the service layer
  (`src/lib/marketplace/ranking.ts`) — transparent weighted score, documented weights.
- **Availability**: UTC internally, professional-timezone + DST correct (`src/lib/availability/calc.ts`).
- **Money**: integer cents everywhere. **Timestamps**: UTC, rendered in the viewer's/pro's timezone.
- **Auth**: roles never trusted from the browser; RLS enforces ownership in the DB.
