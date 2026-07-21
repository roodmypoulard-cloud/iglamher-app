# Database Model

Use UUID primary keys and UTC timestamps. Add `created_at` and `updated_at` to mutable tables.

## Core tables

- `profiles`
- `customer_profiles`
- `professional_profiles`
- `professional_verifications`
- `categories`
- `services`
- `service_addons`
- `professional_portfolio_items`
- `availability_rules`
- `availability_exceptions`
- `addresses`
- `favorites`
- `bookings`
- `booking_line_items`
- `booking_status_events`
- `payments`
- `refunds`
- `payout_records`
- `reviews`
- `conversations`
- `conversation_members`
- `messages`
- `notifications`
- `promo_codes`
- `promo_redemptions`
- `admin_roles`
- `audit_logs`

## Important constraints

- A service belongs to one professional.
- A booking references one customer and one professional.
- A review can be created only for a completed booking.
- Only one customer review per booking.
- Booking price data is snapshotted and must not change when the professional later edits a service.
- Availability queries must account for bookings, buffers, exceptions, and professional timezone.
- Soft-delete public marketplace records when historical transaction references exist.

## Row Level Security

Customers can:
- Read public active professional content
- Read/write their own profile
- Read their own bookings
- Read conversations they belong to
- Create reviews for eligible completed bookings

Professionals can:
- Manage their own professional profile and services
- Read bookings assigned to them
- Manage their availability
- Read their earnings data
- Read conversations they belong to

Admins require server-side role validation. Do not expose unrestricted admin access through normal client keys.
