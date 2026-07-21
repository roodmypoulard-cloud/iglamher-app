# Implementation Plan

## Phase 0 — Repository foundation

- Initialize Next.js, TypeScript, Tailwind, linting, formatting
- Add fonts and design tokens
- Configure Supabase clients
- Create environment validation
- Add component foundation
- Add CI checks

Exit criteria: production build passes.

## Phase 1 — Static luxury UI

- Landing page
- Discover
- Search results
- Professional profile
- Booking screens with mock data
- Auth screens
- Responsive navigation

Exit criteria: UI matches design direction at 390, 768, 1024, and 1440px.

## Phase 2 — Authentication and database

- Supabase Auth
- Profiles and roles
- Database migrations
- RLS
- Seed data
- Customer/professional onboarding

Exit criteria: user roles and data isolation tests pass.

## Phase 3 — Professional marketplace

- Services
- Portfolio
- Availability
- Location/service radius
- Search and filtering
- Favorites

Exit criteria: active professionals can be discovered and selected.

## Phase 4 — Booking engine

- Availability calculation
- Booking drafts
- Line-item pricing
- Conflict prevention
- Status history
- Customer and pro booking views

Exit criteria: concurrent attempts cannot double-book.

## Phase 5 — Payments

- Stripe Connect onboarding
- Checkout/payment intent
- Verified webhooks
- Platform fees
- Refunds
- Earnings and payout records

Exit criteria: test-mode payment lifecycle reconciles correctly.

## Phase 6 — Messaging, reviews, notifications

- Conversations
- Realtime messages
- Reviews
- Email/push/in-app notifications

## Phase 7 — Admin and operations

- Approval queue
- User/professional management
- Booking/refund support
- Audit logs
- Reporting

## Phase 8 — Hardening and launch

- Full QA
- Security review
- Accessibility audit
- Legal policy integration
- Monitoring
- Backups
- Production deployment

Claude must stop after each phase and produce:
- What changed
- Files created
- Commands to run
- Open risks
- Test results
