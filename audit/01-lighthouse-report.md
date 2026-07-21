# Lighthouse Report — iGlamHer

**Target:** https://iglamher-app.vercel.app/discover (production)
**Run:** 2026-07-19, Lighthouse (headless Chrome, mobile emulation)
**Full HTML report:** [`lighthouse.report.html`](./lighthouse.report.html) · **Raw JSON:** [`lighthouse.report.json`](./lighthouse.report.json)

## Category scores

| Category | Score |
|---|---|
| Performance | **72** / 100 🟠 |
| Accessibility | **100** / 100 🟢 |
| Best Practices | **96** / 100 🟢 |
| SEO | **100** / 100 🟢 |

## Core Web Vitals (lab)

| Metric | Value | Verdict |
|---|---|---|
| First Contentful Paint (FCP) | 1.0 s | 🟢 Good |
| Largest Contentful Paint (LCP) | 5.7 s | 🔴 Poor (target < 2.5 s) |
| Total Blocking Time (TBT) | 20 ms | 🟢 Excellent |
| Cumulative Layout Shift (CLS) | 0 | 🟢 Perfect |
| Speed Index | 7.7 s | 🔴 Slow |
| Time to Interactive (TTI) | 5.7 s | 🟠 |

## Headline

The app is **excellent on accessibility (100), SEO (100), and best practices (96)**, and interactivity is superb (TBT 20 ms, CLS 0). The single weak point is **loading performance**, driven almost entirely by the **hero image** being the LCP element and not being optimized/prioritized. See [`02-performance-report.md`](./02-performance-report.md) for the fix — it's the highest-leverage improvement available and should move Performance well into the 90s.
