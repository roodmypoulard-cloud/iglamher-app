// ============================================================
// Marketing / campaigns engine. Pure + deterministic → unit-tested.
// Eligibility, discount application, deterministic A/B bucketing, geo-targeting.
// Money is integer cents.
// ============================================================

export type CampaignType = "coupon" | "seasonal" | "geo" | "abandoned_booking" | "influencer";
export type DiscountType = "percent" | "fixed";

export interface Campaign {
  id: string;
  name: string;
  type: CampaignType;
  discountType: DiscountType;
  discountValue: number; // percent (0-100) or cents
  isActive: boolean;
  startsAt?: string; // UTC ISO
  endsAt?: string;
  /** Restrict to these cities (geo campaigns). Empty = everywhere. */
  cities?: string[];
  minSubtotalCents?: number;
  /** A/B: fraction (0-1) of eligible users in the treatment bucket. */
  abTreatmentFraction?: number;
}

export interface EligibilityContext {
  now: string; // UTC ISO
  city?: string;
  subtotalCents: number;
  userId: string;
}

export function isCampaignLive(c: Campaign, now: string): boolean {
  if (!c.isActive) return false;
  if (c.startsAt && now < c.startsAt) return false;
  if (c.endsAt && now > c.endsAt) return false;
  return true;
}

export function isEligible(c: Campaign, ctx: EligibilityContext): boolean {
  if (!isCampaignLive(c, ctx.now)) return false;
  if (c.minSubtotalCents && ctx.subtotalCents < c.minSubtotalCents) return false;
  if (c.cities && c.cities.length > 0 && (!ctx.city || !c.cities.includes(ctx.city))) return false;
  if (c.abTreatmentFraction != null && c.abTreatmentFraction < 1) {
    return abBucket(c.id, ctx.userId) < c.abTreatmentFraction;
  }
  return true;
}

/** Discount (cents) this campaign applies to a subtotal — never exceeds it. */
export function discountCents(c: Campaign, subtotalCents: number): number {
  const raw = c.discountType === "percent"
    ? Math.round((subtotalCents * Math.min(100, Math.max(0, c.discountValue))) / 100)
    : Math.max(0, Math.round(c.discountValue));
  return Math.min(subtotalCents, raw);
}

/**
 * Deterministic A/B bucket in [0,1) from (campaignId, userId). Stable across
 * requests so a user always sees the same variant.
 */
export function abBucket(campaignId: string, userId: string): number {
  const s = `${campaignId}:${userId}`;
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    hash ^= s.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  return (hash >>> 0) / 0xffffffff;
}

export function abVariant(campaignId: string, userId: string, treatmentFraction = 0.5): "treatment" | "control" {
  return abBucket(campaignId, userId) < treatmentFraction ? "treatment" : "control";
}

/** Pick the single best (largest) applicable discount across campaigns. */
export function bestDiscount(campaigns: Campaign[], ctx: EligibilityContext): { campaign: Campaign; discountCents: number } | null {
  let best: { campaign: Campaign; discountCents: number } | null = null;
  for (const c of campaigns) {
    if (!isEligible(c, ctx)) continue;
    const d = discountCents(c, ctx.subtotalCents);
    if (d > 0 && (!best || d > best.discountCents)) best = { campaign: c, discountCents: d };
  }
  return best;
}
