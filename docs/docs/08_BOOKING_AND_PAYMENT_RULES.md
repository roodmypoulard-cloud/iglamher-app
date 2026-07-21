# Booking and Payment Rules

## Pricing model

Every booking calculates:

`service subtotal + add-ons + travel fee + taxes + customer fee - discounts = total`

Store each line item separately. Never rely only on a single total column.

## Deposits

A professional may require:
- No deposit
- Fixed deposit
- Percentage deposit
- Full prepayment

The customer must see:
- Amount due now
- Remaining amount
- When and how the remainder is collected

MVP recommendation: collect the full transaction through Stripe whenever possible. Offline remainders create disputes and weak accounting.

## Stripe Connect

Use Stripe Connect Express accounts for professionals.

Typical flow:
1. Customer pays platform
2. Platform records fee
3. Connected account receives eligible proceeds
4. Funds remain subject to refund/dispute rules
5. Webhooks update local state

Do not mark a booking paid based only on a client redirect. Verify webhook events.

## Cancellation

Policies must be configurable and snapshotted on the booking.

Initial policy suggestion:
- Free cancellation at least 24 hours before appointment
- Late cancellation may forfeit deposit
- Professional cancellation triggers full customer refund
- No-show rules require evidence and admin review for disputes

Legal review is required before launch.

## Idempotency

All payment, refund, and booking-confirmation mutations must be idempotent.

## Webhooks

Handle at minimum:
- Checkout/payment success
- Payment failure
- Refund updates
- Dispute events
- Connected account status
- Transfer/payout events

Store webhook event IDs to prevent duplicate processing.
