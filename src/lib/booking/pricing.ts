// ============================================================
// Booking price + commission engine. Pure, deterministic, integer cents.
//
// Model:
//   subtotal      = service price + selected add-ons
//   travelFee     = on-site upcharge (mobile only)
//   tax           = taxRateBps applied to (subtotal + travelFee)
//   discount      = promo (applied before tax is computed on the net)
//   tip           = optional, passes through to the professional
//   total         = subtotal + travelFee + tax - discount + tip
//   platformFee   = takeRateBps of (subtotal + travelFee)  ← platform commission
//   professionalNet = subtotal + travelFee + tip - platformFee
//   amountDueNow  = deposit (percent/fixed/full) of total
//
// Tips and taxes are never part of the platform's commission base.
// ============================================================

export type DepositType = "full" | "percent" | "fixed" | "none";

export interface PricingInput {
  serviceCents: number;
  addonsCents?: number;
  travelFeeCents?: number;
  taxRateBps?: number; // e.g. 950 = 9.5%
  discountCents?: number;
  tipCents?: number;
  takeRateBps: number; // platform commission, e.g. 1500 = 15%
  deposit?: { type: DepositType; value?: number };
}

export interface PriceLineItem {
  kind: "service" | "addon" | "upcharge" | "tax" | "discount" | "tip" | "fee";
  label: string;
  amountCents: number;
}

export interface PriceBreakdown {
  subtotalCents: number;
  addonsCents: number;
  travelFeeCents: number;
  taxCents: number;
  discountCents: number;
  tipCents: number;
  totalCents: number;
  platformFeeCents: number; // commission the platform keeps
  professionalNetCents: number; // what the stylist earns
  amountDueNowCents: number; // deposit or full
  lineItems: PriceLineItem[];
}

const clampNonNeg = (n: number) => Math.max(0, Math.round(n));

export function computeBooking(input: PricingInput): PriceBreakdown {
  const service = clampNonNeg(input.serviceCents);
  const addons = clampNonNeg(input.addonsCents ?? 0);
  const travel = clampNonNeg(input.travelFeeCents ?? 0);
  const tip = clampNonNeg(input.tipCents ?? 0);

  const subtotal = service + addons;
  const taxableBase = Math.max(0, subtotal + travel - clampNonNeg(input.discountCents ?? 0));
  const discount = Math.min(clampNonNeg(input.discountCents ?? 0), subtotal + travel);
  const tax = Math.round((taxableBase * clampNonNeg(input.taxRateBps ?? 0)) / 10000);

  const total = subtotal + travel + tax - discount + tip;

  // Commission base excludes tax and tip.
  const commissionBase = subtotal + travel - discount;
  const platformFee = Math.max(0, Math.round((commissionBase * input.takeRateBps) / 10000));
  const professionalNet = commissionBase - platformFee + tip;

  const amountDueNow = computeDeposit(total, input.deposit);

  const lineItems: PriceLineItem[] = [
    { kind: "service", label: "Service", amountCents: service },
  ];
  if (addons > 0) lineItems.push({ kind: "addon", label: "Add-ons", amountCents: addons });
  if (travel > 0) lineItems.push({ kind: "upcharge", label: "Travel fee", amountCents: travel });
  if (discount > 0) lineItems.push({ kind: "discount", label: "Discount", amountCents: -discount });
  if (tax > 0) lineItems.push({ kind: "tax", label: "Tax", amountCents: tax });
  if (tip > 0) lineItems.push({ kind: "tip", label: "Tip", amountCents: tip });

  return {
    subtotalCents: subtotal,
    addonsCents: addons,
    travelFeeCents: travel,
    taxCents: tax,
    discountCents: discount,
    tipCents: tip,
    totalCents: total,
    platformFeeCents: platformFee,
    professionalNetCents: professionalNet,
    amountDueNowCents: amountDueNow,
    lineItems,
  };
}

export function computeDeposit(totalCents: number, deposit?: { type: DepositType; value?: number }): number {
  if (!deposit || deposit.type === "full" || deposit.type === "none") return totalCents;
  if (deposit.type === "percent") {
    const pct = Math.min(100, Math.max(0, deposit.value ?? 0));
    return Math.min(totalCents, Math.round((totalCents * pct) / 100));
  }
  if (deposit.type === "fixed") return Math.min(totalCents, clampNonNeg(deposit.value ?? 0));
  return totalCents;
}

/**
 * Cancellation fee based on hours before the appointment.
 * >48h: free. 24–48h: 50% of deposit. <24h: 100% of deposit (non-refundable).
 */
export function cancellationFee(
  depositCents: number,
  hoursUntilStart: number,
): { feeCents: number; refundCents: number; tier: string } {
  if (hoursUntilStart >= 48) return { feeCents: 0, refundCents: depositCents, tier: "free" };
  if (hoursUntilStart >= 24) {
    const fee = Math.round(depositCents / 2);
    return { feeCents: fee, refundCents: depositCents - fee, tier: "half" };
  }
  return { feeCents: depositCents, refundCents: 0, tier: "full" };
}
