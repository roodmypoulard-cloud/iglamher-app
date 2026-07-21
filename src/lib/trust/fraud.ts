// ============================================================
// Fraud risk scoring. Pure heuristic engine → unit-tested. Produces a 0–100
// risk score and the reasons, which the fraud dashboard surfaces for review.
//
// NOTE: signal *collection* (device fingerprints, IP/geo, shared cards) is done
// upstream by instrumentation; this module only SCORES a collected signal set.
// Fraud actions freeze/flag — they never delete user data (business rule).
// ============================================================

export interface FraudSignals {
  accountAgeHours: number;
  sharedPaymentMethodAccounts: number; // other accounts using the same card
  sharedDeviceAccounts: number; // other accounts on the same device fingerprint
  bookingsLast24h: number;
  cancellationRate: number; // 0..1
  chargebackCount: number;
  distinctLocationsLast24h: number; // impossible-travel signal
  reviewsWrittenLast24h: number;
  failedPaymentsLast24h: number;
}

export type RiskLevel = "low" | "medium" | "high" | "critical";

export interface FraudResult {
  score: number; // 0–100
  level: RiskLevel;
  reasons: string[];
}

interface Rule {
  test: (s: FraudSignals) => boolean;
  weight: number;
  reason: string;
}

const RULES: Rule[] = [
  { test: (s) => s.accountAgeHours < 1, weight: 15, reason: "Rapid account creation (<1h old)" },
  { test: (s) => s.sharedPaymentMethodAccounts >= 2, weight: 22, reason: "Payment method shared across accounts" },
  { test: (s) => s.sharedDeviceAccounts >= 3, weight: 18, reason: "Multiple accounts on one device" },
  { test: (s) => s.bookingsLast24h >= 8, weight: 14, reason: "Unusual booking volume (24h)" },
  { test: (s) => s.cancellationRate >= 0.5, weight: 16, reason: "Excessive cancellations" },
  { test: (s) => s.chargebackCount >= 1, weight: 25, reason: "Chargeback history" },
  { test: (s) => s.distinctLocationsLast24h >= 3, weight: 12, reason: "Suspicious location changes" },
  { test: (s) => s.reviewsWrittenLast24h >= 5, weight: 10, reason: "Possible fake reviews" },
  { test: (s) => s.failedPaymentsLast24h >= 3, weight: 12, reason: "Repeated failed payments" },
];

export function scoreFraud(signals: FraudSignals): FraudResult {
  let score = 0;
  const reasons: string[] = [];
  for (const rule of RULES) {
    if (rule.test(signals)) {
      score += rule.weight;
      reasons.push(rule.reason);
    }
  }
  score = Math.min(100, score);
  return { score, level: levelFor(score), reasons };
}

function levelFor(score: number): RiskLevel {
  if (score >= 60) return "critical";
  if (score >= 40) return "high";
  if (score >= 20) return "medium";
  return "low";
}
