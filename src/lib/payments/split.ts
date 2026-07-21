// Pure payout-split math (no server-only import) so it's unit-testable and shared
// between the webhook and the payout module.
//
// The professional's payout = booking total − platform commission. Tax and tip
// are already accounted for in the denormalized `total_cents`/`platform_fee_cents`
// on the booking (see pricing.ts: commission base excludes tax and tip).
export function payoutAmountCents(totalCents: number, platformFeeCents: number): number {
  return Math.max(0, Math.round(totalCents) - Math.round(platformFeeCents));
}
