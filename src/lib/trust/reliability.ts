// ============================================================
// Reliability & trust scoring. Pure, deterministic → fully unit-tested.
//
// Business rules encoded here:
//  • A reliability score (0–100) is computed for stylists and customers.
//  • Providers with repeated cancellations automatically lose search ranking
//    (rankingMultiplier < 1) — see marketplace ranking integration.
//  • Trust scores influence marketplace visibility.
// ============================================================

export interface StylistReliabilityInput {
  bookingsAccepted: number;
  bookingsDeclined: number;
  bookingsCompleted: number;
  bookingsCancelledByPro: number;
  noShows: number;
  lateArrivals: number;
  avgResponseMinutes: number | null;
  totalBookings: number; // accepted + declined (requests seen)
}

export interface CustomerReliabilityInput {
  bookingsMade: number;
  cancellations: number;
  lateCancellations: number;
  noShows: number;
}

export interface ReliabilityResult {
  score: number; // 0–100
  rankingMultiplier: number; // 0.5–1.05, applied to search score
  tier: "excellent" | "good" | "fair" | "at_risk";
}

const clamp = (n: number, lo = 0, hi = 1) => Math.max(lo, Math.min(hi, n));
const rate = (part: number, whole: number) => (whole > 0 ? part / whole : 0);

export function stylistReliability(m: StylistReliabilityInput): ReliabilityResult {
  const acceptance = rate(m.bookingsAccepted, m.totalBookings || m.bookingsAccepted + m.bookingsDeclined);
  const completion = rate(m.bookingsCompleted, m.bookingsAccepted || 1);
  const cancelRate = rate(m.bookingsCancelledByPro, m.bookingsAccepted || 1);
  const noShowRate = rate(m.noShows, m.bookingsAccepted || 1);
  const lateRate = rate(m.lateArrivals, m.bookingsCompleted || 1);
  // Response: <=30min ideal, >=240min poor.
  const responseScore = m.avgResponseMinutes == null ? 0.6 : clamp(1 - (m.avgResponseMinutes - 30) / 210);

  // New stylists (no history) start at a neutral-good baseline, not penalized.
  if ((m.bookingsAccepted ?? 0) + (m.bookingsDeclined ?? 0) === 0) {
    return { score: 80, rankingMultiplier: 1, tier: "good" };
  }

  const raw =
    0.30 * completion +
    0.20 * acceptance +
    0.20 * (1 - cancelRate) +
    0.15 * (1 - noShowRate) +
    0.08 * (1 - lateRate) +
    0.07 * responseScore;

  const score = Math.round(clamp(raw) * 100);
  return { score, rankingMultiplier: multiplierFor(score, cancelRate), tier: tierFor(score) };
}

export function customerReliability(m: CustomerReliabilityInput): ReliabilityResult {
  if (m.bookingsMade === 0) return { score: 80, rankingMultiplier: 1, tier: "good" };
  const cancelRate = rate(m.cancellations, m.bookingsMade);
  const lateRate = rate(m.lateCancellations, m.bookingsMade);
  const noShowRate = rate(m.noShows, m.bookingsMade);
  const raw = 1 - (0.4 * cancelRate + 0.3 * lateRate + 0.3 * noShowRate);
  const score = Math.round(clamp(raw) * 100);
  return { score, rankingMultiplier: 1, tier: tierFor(score) };
}

// Repeated cancellations sink ranking harder than the score alone.
function multiplierFor(score: number, cancelRate: number): number {
  let mult = 0.5 + (score / 100) * 0.55; // 0.5 → 1.05
  if (cancelRate >= 0.3) mult *= 0.6;
  else if (cancelRate >= 0.15) mult *= 0.8;
  return Math.round(clamp(mult, 0.4, 1.05) * 100) / 100;
}

function tierFor(score: number): ReliabilityResult["tier"] {
  if (score >= 90) return "excellent";
  if (score >= 75) return "good";
  if (score >= 55) return "fair";
  return "at_risk";
}

/**
 * Search-ranking multiplier from a stored reliability score (0–100).
 * Neutral at ~80; boosts the reliable, demotes the at-risk. Keeps trust
 * influencing visibility without letting it dominate relevance.
 */
export function rankingMultiplierFromScore(score: number): number {
  const s = clamp(score / 100);
  return Math.round((0.7 + s * 0.4) * 100) / 100; // 0.70 → 1.10
}
