// ============================================================
// iGlam Rewards — loyalty engine. Pure + deterministic → unit-tested.
// Points, tiers, milestones, birthday rewards, redemption. All integer math.
// ============================================================

export type LoyaltyTier = "bronze" | "silver" | "gold" | "platinum";

export interface TierDef {
  tier: LoyaltyTier;
  minLifetimePoints: number;
  label: string;
  perkMultiplier: number; // earn-rate multiplier
}

export const TIERS: TierDef[] = [
  { tier: "bronze", minLifetimePoints: 0, label: "Bronze", perkMultiplier: 1 },
  { tier: "silver", minLifetimePoints: 500, label: "Silver", perkMultiplier: 1.1 },
  { tier: "gold", minLifetimePoints: 1500, label: "Gold", perkMultiplier: 1.25 },
  { tier: "platinum", minLifetimePoints: 4000, label: "Platinum VIP", perkMultiplier: 1.5 },
];

// 1 point per $1 spent (on the total, excluding tips). Redemption: 100 pts = $5.
const POINTS_PER_DOLLAR = 1;
const REDEEM_POINTS = 100;
const REDEEM_CENTS = 500;

export function tierForLifetime(lifetimePoints: number): TierDef {
  let current = TIERS[0];
  for (const t of TIERS) if (lifetimePoints >= t.minLifetimePoints) current = t;
  return current;
}

export function tierProgress(lifetimePoints: number): {
  tier: TierDef;
  next: TierDef | null;
  pointsToNext: number;
  progressPct: number;
} {
  const tier = tierForLifetime(lifetimePoints);
  const idx = TIERS.findIndex((t) => t.tier === tier.tier);
  const next = idx < TIERS.length - 1 ? TIERS[idx + 1] : null;
  if (!next) return { tier, next: null, pointsToNext: 0, progressPct: 100 };
  const span = next.minLifetimePoints - tier.minLifetimePoints;
  const into = lifetimePoints - tier.minLifetimePoints;
  return {
    tier,
    next,
    pointsToNext: Math.max(0, next.minLifetimePoints - lifetimePoints),
    progressPct: Math.round(Math.min(100, (into / span) * 100)),
  };
}

/** Points earned for a completed booking, tier multiplier applied. */
export function pointsForBooking(subtotalCents: number, lifetimePoints = 0): number {
  const base = Math.floor((subtotalCents / 100) * POINTS_PER_DOLLAR);
  const mult = tierForLifetime(lifetimePoints).perkMultiplier;
  return Math.floor(base * mult);
}

/** Milestone bonus points at booking-count thresholds (1st, 5th, 10th, 25th…). */
export function milestoneBonus(completedBookingCount: number): number {
  const map: Record<number, number> = { 1: 100, 5: 250, 10: 500, 25: 1000, 50: 2500 };
  return map[completedBookingCount] ?? 0;
}

export const BIRTHDAY_BONUS_POINTS = 200;

/** Max cents a customer can redeem given their point balance. */
export function maxRedeemableCents(pointBalance: number): number {
  const units = Math.floor(pointBalance / REDEEM_POINTS);
  return units * REDEEM_CENTS;
}

/** Convert a requested discount in cents to the point cost (rounded up to a unit). */
export function pointsForRedemption(discountCents: number): number {
  const units = Math.ceil(discountCents / REDEEM_CENTS);
  return units * REDEEM_POINTS;
}

export function canRedeem(pointBalance: number, discountCents: number): boolean {
  return pointsForRedemption(discountCents) <= pointBalance && discountCents > 0;
}
