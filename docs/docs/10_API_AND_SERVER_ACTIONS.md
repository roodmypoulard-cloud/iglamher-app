# API and Server Actions

Prefer typed server actions for app-owned mutations and route handlers for webhooks/public integrations.

## Customer actions

- Search professionals
- Fetch professional profile
- Fetch availability
- Create booking draft
- Apply promotion
- Create Stripe checkout/payment intent
- Confirm booking after verified payment
- Cancel booking
- Request reschedule
- Favorite/unfavorite professional
- Create review
- Send message
- Mark notification read

## Professional actions

- Update profile
- Upload portfolio media
- Create/update/archive service
- Update recurring availability
- Add availability exception
- Accept/decline booking when approval is required
- Request reschedule
- Update appointment progress
- Respond to review
- Initiate Stripe onboarding
- Open Stripe dashboard link

## Admin actions

- Approve/reject professional
- Suspend user/professional
- Issue refund
- Update categories
- Feature professional
- Resolve dispute
- Export operational report

## Security

- Authenticate every private action
- Validate ownership and role
- Validate input with Zod
- Rate-limit authentication, search, messages, and promo attempts
- Escape user content
- Scan uploads and enforce MIME/size limits
- Maintain audit trails for admin and financial actions
