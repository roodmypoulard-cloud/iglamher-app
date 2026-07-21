# Analytics, Testing, and Quality

## Analytics events

- `search_submitted`
- `filter_applied`
- `professional_viewed`
- `service_selected`
- `booking_started`
- `timeslot_selected`
- `checkout_started`
- `booking_confirmed`
- `booking_cancelled`
- `review_submitted`
- `professional_onboarding_started`
- `professional_onboarding_completed`
- `service_created`

Never send sensitive payment, identity, or private message content to analytics.

## Critical end-to-end tests

1. Customer registers and completes profile.
2. Customer searches and views a professional.
3. Customer selects service and available time.
4. Customer pays and receives confirmed booking.
5. Double-booking attempt fails safely.
6. Customer cancels within allowed period.
7. Professional creates service and availability.
8. Professional receives and manages booking.
9. Completed customer can leave one review.
10. Unauthorized user cannot view another user’s bookings or messages.
11. Stripe webhook replay does not duplicate booking/payment.
12. Mobile navigation works at 390px.

## Performance targets

- Lighthouse performance: 85+ for major public pages
- Accessibility: 95+
- Avoid layout shifts
- Optimize hero and portfolio images
- Paginate or virtualize long lists
- Use database indexes for location/status/date searches
