// ============================================================
// Referral engine. Pure + deterministic → unit-tested.
// Code generation, reward computation, and fraud checks for customer and
// professional referrals. Rewards are integer cents / loyalty points.
// ============================================================

export type ReferralKind = "customer" | "professional";
export type ReferralStatus = "pending" | "qualified" | "rewarded" | "rejected";

export interface ReferralRewardConfig {
  /** Credit (cents) to the referrer once the referred user qualifies. */
  referrerCreditCents: number;
  /** Welcome credit (cents) to the referred user. */
  referredCreditCents: number;
  /** Loyalty points to the referrer. */
  referrerPoints: number;
}

export const REWARD_CONFIG: Record<ReferralKind, ReferralRewardConfig> = {
  customer: { referrerCreditCents: 1500, referredCreditCents: 1500, referrerPoints: 250 },
  professional: { referrerCreditCents: 5000, referredCreditCents: 0, referrerPoints: 1000 },
};

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars

/**
 * Deterministic, human-friendly referral code from a stable seed (e.g. user id).
 * Same seed → same code, so codes are reproducible without storing randomness.
 */
export function generateReferralCode(seed: string, prefix = "GLAM"): string {
  let hash = 2166136261 >>> 0;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619) >>> 0;
  }
  let body = "";
  for (let i = 0; i < 6; i++) {
    body += ALPHABET[hash % ALPHABET.length];
    hash = Math.floor(hash / ALPHABET.length) || (hash ^ (i + 1) * 2654435761) >>> 0;
  }
  return `${prefix}-${body}`;
}

export interface FraudCheckInput {
  referrerId: string;
  referredId: string;
  sameDevice?: boolean;
  sameIp?: boolean;
  referredAccountAgeHours?: number;
  referrerReferralsLast24h?: number;
  /** How many referral applications came from this IP in the last 24h. */
  ipReferralsLast24h?: number;
}

export interface FraudResult {
  ok: boolean;
  reasons: string[];
}

/** Per-IP referral-application cap in a rolling 24h window (Sybil defence). */
export const IP_REFERRAL_LIMIT_24H = 5;
/** Per-referrer referral cap in a rolling 24h window. */
export const REFERRER_VELOCITY_LIMIT_24H = 20;

/** Reject self-referrals and obvious abuse; the reward only pays out when ok. */
export function checkReferralFraud(input: FraudCheckInput): FraudResult {
  const reasons: string[] = [];
  if (input.referrerId === input.referredId) reasons.push("Self-referral");
  if (input.sameDevice) reasons.push("Same device as referrer");
  if (input.sameIp && input.referredAccountAgeHours != null && input.referredAccountAgeHours < 1) {
    reasons.push("Same IP + brand-new account");
  }
  if ((input.referrerReferralsLast24h ?? 0) >= REFERRER_VELOCITY_LIMIT_24H) {
    reasons.push("Referral velocity too high");
  }
  if ((input.ipReferralsLast24h ?? 0) >= IP_REFERRAL_LIMIT_24H) {
    reasons.push("Too many sign-ups from this network");
  }
  return { ok: reasons.length === 0, reasons };
}

/** A referral qualifies when the referred user completes their first paid booking. */
export function qualifies(referredCompletedBookings: number): boolean {
  return referredCompletedBookings >= 1;
}

export function rewardFor(kind: ReferralKind): ReferralRewardConfig {
  return REWARD_CONFIG[kind];
}
