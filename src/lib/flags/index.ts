// ============================================================
// Feature flags. Config defaults + env overrides + deterministic percentage
// rollout per user (canary). Pure → unit-tested. No vendor needed; swap the
// resolver for LaunchDarkly/Statsig later behind the same isEnabled() API.
// ============================================================

export type FlagKey =
  | "ai_recommendations"
  | "recommendation_shelves"
  | "loyalty"
  | "referrals"
  | "campaigns"
  | "nl_search"
  | "voice_calling"
  | "live_presence";

interface FlagDef {
  default: boolean;
  /** 0..1 fraction of users in the ON bucket when default is a gradual rollout. */
  rollout?: number;
  description: string;
}

export const FLAGS: Record<FlagKey, FlagDef> = {
  ai_recommendations: { default: true, description: "Personalized 'Recommended for you'" },
  recommendation_shelves: { default: true, description: "Trending / Top rated / New / Luxury shelves" },
  loyalty: { default: true, description: "iGlam Rewards points & tiers" },
  referrals: { default: true, description: "Referral codes & rewards" },
  campaigns: { default: true, description: "Marketing campaigns & discounts" },
  nl_search: { default: true, description: "Natural-language search parsing" },
  voice_calling: { default: false, description: "In-app voice (needs provider)" },
  live_presence: { default: false, rollout: 0, description: "Online status & live updates" },
};

function envOverride(key: FlagKey): boolean | null {
  const raw = process.env[`FLAG_${key.toUpperCase()}`];
  if (raw == null) return null;
  return ["1", "true", "on", "yes"].includes(raw.toLowerCase());
}

/** Deterministic 0..1 bucket for (flag, user) — stable per user across requests. */
export function rolloutBucket(key: FlagKey, userId: string): number {
  const s = `${key}:${userId}`;
  let h = 2166136261 >>> 0;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return (h >>> 0) / 0xffffffff;
}

export function isEnabled(key: FlagKey, userId?: string): boolean {
  const override = envOverride(key);
  if (override != null) return override;
  const def = FLAGS[key];
  if (def.rollout != null && userId) return rolloutBucket(key, userId) < def.rollout;
  return def.default;
}

export function allFlags(userId?: string): Record<FlagKey, boolean> {
  return Object.fromEntries((Object.keys(FLAGS) as FlagKey[]).map((k) => [k, isEnabled(k, userId)])) as Record<FlagKey, boolean>;
}
