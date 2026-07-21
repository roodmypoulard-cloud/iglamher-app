# Information Architecture and Routes

## Public routes

- `/`
- `/discover`
- `/search`
- `/categories/[slug]`
- `/professionals/[slug]`
- `/services/[id]`
- `/about`
- `/how-it-works`
- `/become-a-pro`
- `/help`
- `/legal/terms`
- `/legal/privacy`
- `/legal/cancellation`

## Authentication

- `/auth/sign-in`
- `/auth/sign-up`
- `/auth/forgot-password`
- `/auth/reset-password`
- `/auth/verify`
- `/onboarding/customer`
- `/onboarding/professional`

## Customer portal

- `/account`
- `/account/bookings`
- `/account/bookings/[id]`
- `/account/favorites`
- `/account/messages`
- `/account/messages/[conversationId]`
- `/account/payments`
- `/account/profile`
- `/account/settings`

## Booking flow

- `/book/[professionalSlug]/service`
- `/book/[professionalSlug]/date-time`
- `/book/[professionalSlug]/details`
- `/book/[professionalSlug]/payment`
- `/book/confirmation/[bookingId]`

## Professional portal

- `/pro`
- `/pro/calendar`
- `/pro/bookings`
- `/pro/bookings/[id]`
- `/pro/services`
- `/pro/services/new`
- `/pro/services/[id]/edit`
- `/pro/availability`
- `/pro/clients`
- `/pro/messages`
- `/pro/reviews`
- `/pro/earnings`
- `/pro/payouts`
- `/pro/profile`
- `/pro/settings`

## Admin

- `/admin`
- `/admin/users`
- `/admin/professionals`
- `/admin/professionals/[id]`
- `/admin/bookings`
- `/admin/payments`
- `/admin/disputes`
- `/admin/reviews`
- `/admin/categories`
- `/admin/content`
- `/admin/reports`
- `/admin/settings`

## Navigation model

Mobile customer navigation:
- Home
- Bookings
- Primary action/search
- Messages
- Profile

Desktop customer navigation:
- Logo
- Discover
- Categories
- Bookings
- Messages
- Favorites
- Account

Professional navigation should use a desktop sidebar and a simplified mobile bottom bar.
