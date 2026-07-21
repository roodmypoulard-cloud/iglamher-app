# Performance Report — iGlamHer

**Source:** Lighthouse lab run on `/discover` (production), mobile emulation, 2026-07-19.
**Overall Performance score: 72/100.** Interactivity is excellent; loading is the bottleneck.

## Metrics

| Metric | Value | Weight | Notes |
|---|---|---|---|
| FCP | 1.0 s | 10% | 🟢 Fast first paint — text/fonts render quickly |
| **LCP** | **5.7 s** | 25% | 🔴 The main problem. LCP element = the hero photo |
| TBT | 20 ms | 30% | 🟢 Almost no main-thread blocking |
| CLS | 0 | 25% | 🟢 Zero layout shift (blur placeholders + fixed dims pay off) |
| Speed Index | 7.7 s | 10% | 🔴 Follows from the slow hero image |

## Root cause: the hero image is the LCP and is un-optimized

The Discover hero renders the two-model photo with a **plain `<img>`** (`HeroLuxury` / `DiscoverTopbar` use `<img>`, not `next/image`). Consequences flagged by Lighthouse:

- **"Improve image delivery" / "LCP request discovery" / "LCP breakdown"** — the hero JPEG (`/brand/hero-discover.jpg`, ~380 KB) is not preloaded, not `fetchpriority=high`, and not served in a modern format at responsive sizes.
- **"Image elements do not have explicit width and height"** — the `<img>` tags have no intrinsic dimensions (CLS is still 0 thanks to CSS `inset:0`, but the browser can't reserve space early).
- Because it's a plain `<img>`, Next.js image optimization (AVIF/WebP, responsive `srcset`, priority preload) is bypassed.

## Recommendations (highest → lowest leverage)

1. **Convert the hero to `next/image` with `priority`** (biggest win). Use `<Image src="/brand/hero-discover.jpg" fill priority sizes="100vw" />`. This adds `fetchpriority=high` + preload, serves AVIF/WebP, and generates responsive sizes. Expected LCP drop from ~5.7 s toward < 2.5 s and Performance into the low 90s. The category tiles already use the optimized `SmartImage`/`next/image`; the hero is the one exception.
2. **Compress/re-encode the hero JPEG** (or let next/image do it). Current bespoke hero assets are 250–400 KB; a WebP/AVIF at responsive widths would be a fraction of that.
3. **Preload the hero** if kept as `<img>`: add `<link rel="preload" as="image" href="/brand/hero-discover.jpg" fetchpriority="high">` in the head. Lesser fix than #1.
4. **Reduce unused JavaScript (~73 KiB est. savings)** and **legacy JS** — mostly framework/polyfill overhead; minor. Route-level code splitting is already in place (see `04-bundle-and-routes.txt`). Low priority vs. the image.
5. **bfcache**: "Page prevented back/forward cache restoration" — usually caused by an unload/beforeunload listener or a non-cacheable header. Minor; worth checking the scroll listener cleanup (it is cleaned up) and any WebSocket/analytics.
6. Add explicit `width`/`height` (or `aspect-ratio`) to the hero `<img>` even if kept as `<img>`, so space is reserved earlier.

## What's already good

- **TBT 20 ms / CLS 0** — the app is snappy and visually stable. Animations are GPU-composited and guarded by `prefers-reduced-motion`.
- **FCP 1.0 s** — fast fonts (`next/font` with `display: swap`) and a lightweight initial paint.
- Category/portfolio/provider imagery already uses `next/image` via `SmartImage` (blur placeholder, lazy, responsive `sizes`).
- Server response time excellent (root doc 20 ms).

**Bottom line:** one change (hero → `next/image priority`) fixes the only real performance gap.
