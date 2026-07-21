# Accessibility Report — iGlamHer

**Source:** Lighthouse accessibility audit on `/discover` (production), 2026-07-19.
**Score: 100 / 100 🟢** — no failing accessibility audits.

## Audits passing (key checks)

| Audit | Status | Meaning |
|---|---|---|
| `color-contrast` | ✅ | Text meets WCAG AA contrast (rose-gold/ink on dark surfaces) |
| `image-alt` | ✅ | Images have `alt` (decorative hero uses `alt=""`, meaningful images labelled) |
| `button-name` | ✅ | All buttons have accessible names (aria-labels on icon buttons) |
| `link-name` | ✅ | All links have discernible text/labels |
| `label` | ✅ | Form inputs (search) are labelled (`aria-label`) |
| `aria-required-attr` | ✅ | ARIA attributes used correctly |
| `html-has-lang` | ✅ | `<html lang>` set |
| `meta-viewport` | ✅ | Responsive viewport, zoom not disabled |
| `tap-targets` | ✅ | Touch targets adequately sized |

## Practices observed in the code

- **Semantic structure:** `<h1>` for the hero title, section headings, `role="search"` on the search form, `aria-labelledby` on the hero section.
- **Icon-only controls** (notification bell, profile avatar, favorite/heart, search submit) all carry `aria-label`s.
- **Decorative imagery** (hero background, gradient overlays, ambient glow, rim SVG) uses `aria-hidden` / empty `alt`.
- **Focus visibility:** global `:focus-visible { outline: 2px solid rose }`.
- **Motion sensitivity:** all animations wrapped in `@media (prefers-reduced-motion: no-preference)`; a `prefers-reduced-motion: reduce` block disables the hero Ken Burns, logo fade, and search transitions.
- **Avatars:** initials fallback with proper contrast; profile photo has meaningful `alt`.

## Minor recommendations (not flagged, polish only)

- One Lighthouse best-practices note ("Elements with visible text labels do not have matching accessible names") can occur when an icon button's `aria-label` differs from adjacent visible text; worth a spot-check on any chip/button that pairs an icon with a differently-worded label. It did **not** reduce the a11y score.
- Consider adding a "Skip to content" link for keyboard users on long pages (nice-to-have).
- Verify the sticky topbar's contrast in its transparent-over-hero state on the very brightest hero frames (contrast passed in the audited state).

**Bottom line:** accessibility is in excellent shape (perfect score) with genuinely good practices in the code, not just passing checks.
