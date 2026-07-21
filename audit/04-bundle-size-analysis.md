# Bundle Size Analysis — iGlamHer

**Build:** `next build` (Next.js 16, Turbopack), 2026-07-19.
**Note:** the Turbopack production build does not emit the classic per-route "First Load JS" table, so figures below are measured directly from `.next/static` (uncompressed on-disk sizes). Over the wire these are served with Brotli/gzip and are roughly **3–4× smaller** than shown.

## Totals (uncompressed, on disk)

| Asset type | Size |
|---|---|
| All JS chunks | ~1,696 KB (est. ~450–550 KB transferred, compressed) |
| All CSS | ~91 KB (est. ~15–20 KB transferred) |

## Largest JS chunks

| Chunk | Size (KB, raw) | Likely contents |
|---|---|---|
| `3szwarg70504l.js` | 280 | React + Next.js runtime / framework |
| `2tmyy2x38il70.js` | 244 | Vendor (Supabase JS client, auth-helpers) |
| `0iec5q4ack_04.js` | 224 | Vendor / shared app libs |
| `1pjmx90rl1gdn.js` | 116 | Shared app code |
| `0cz1d0mv5g_q7.js` | 112 | Shared app code |
| remainder | ≤ 56 KB each | Per-route/page chunks (mostly 28–32 KB) — good code-splitting |

The long tail of **28–32 KB per-route chunks** shows healthy route-level code splitting: each page ships a small slice, and the weight is concentrated in the shared framework + Supabase vendor chunks (expected for a Supabase/Stripe app).

## Assessment

- **Reasonable for the feature set.** ~450–550 KB compressed shared JS is typical for a Next.js App Router app with Supabase auth + realtime + Stripe. It is *not* the cause of the performance score — TBT is 20 ms, so JS execution is not blocking.
- **Lighthouse "unused JavaScript ≈ 73 KiB"** and "legacy JavaScript" are the only JS opportunities, and they're modest. Most of the unused JS is framework/polyfill code that ships regardless.
- **CSS is lean (~91 KB raw).** Tailwind v4 with `@theme` tokens tree-shakes well; the hero uses one scoped CSS module.

## Recommendations (low priority)

1. **The bundle is not the bottleneck — the hero image is** (see `02-performance-report.md`). Fix that first.
2. If squeezing further: audit the Supabase client import surface (import only what's needed), and confirm the Stripe SDK is only loaded on payment routes, not globally.
3. Consider `@next/bundle-analyzer` in the repo for ongoing visibility (Turbopack build hides per-route sizes). Add it as a `build:analyze` script for future audits.
4. Legacy-JS savings would require adjusting the browserslist/target; low ROI given TBT is already excellent.

**Bottom line:** bundle size is healthy and well split; no action required for launch.
