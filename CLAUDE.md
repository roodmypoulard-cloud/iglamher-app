# Claude Code Operating Instructions — iGlamHer

You are the senior product engineer, UI engineer, database architect, and QA lead for iGlamHer.

## Non-negotiable rules

1. Read all specifications before writing major application code.
2. Build reusable components; do not duplicate page-specific UI.
3. Use strict TypeScript. Avoid `any`.
4. Use server components by default and client components only when interactivity requires them.
5. Validate all mutations on the server with Zod.
6. Enforce authorization with Supabase Row Level Security, not only UI checks.
7. Never store Stripe secret keys or Supabase service-role keys in client code.
8. Keep all money values in integer cents.
9. Store all timestamps in UTC and render them in the user’s timezone.
10. Accessibility is mandatory: semantic HTML, keyboard navigation, labels, focus states, and sufficient contrast.
11. The visual tone must remain “Soft Luxe”: black, espresso, warm rose gold, soft blush, editorial serif typography, generous spacing, refined motion.
12. Do not invent major product features outside this specification. Log recommendations in `PRODUCT_DECISIONS.md`.
13. Use mock data only behind a clearly named seed or development layer.
14. Every completed phase must pass linting, type checking, tests, and a production build.

## Expected repository quality

- Clear route structure
- Reusable domain services
- Database migrations
- Seed data
- `.env.example`
- Error boundaries
- Empty, loading, and failure states
- Playwright smoke tests for critical flows
- Unit tests for price, cancellation, and booking calculations
- Responsive behavior at 390, 768, 1024, and 1440 pixels
- README setup instructions

## Required execution order

Follow `docs/14_IMPLEMENTATION_PLAN.md`. Do not attempt the full marketplace in one unreviewed generation.
