// ============================================================
// Contact-info guard — MANDATORY business rule.
//
// Before a booking is confirmed & paid, customers and professionals may not
// exchange contact info. This detects (and can redact) phone numbers, emails,
// social handles/platforms, external links, and common spelled-out evasions.
//
// Pure + deterministic → fully unit-tested. Enforced server-side on every
// pre-payment message; the client uses it for instant inline warnings.
// ============================================================

export type ContactViolation = "phone" | "email" | "url" | "social" | "handle" | "evasion";

export interface GuardResult {
  blocked: boolean;
  violations: ContactViolation[];
  redacted: string; // message with detected contact info masked
}

// Order matters for de-duped, stable reporting.
const VIOLATION_ORDER: ContactViolation[] = ["phone", "email", "url", "social", "handle", "evasion"];

// Spelled-out digits used to evade the phone regex ("five one five...").
const NUMBER_WORDS = "(?:zero|one|two|three|four|five|six|seven|eight|nine|oh|o)";

const PATTERNS: Array<{ type: ContactViolation; re: RegExp }> = [
  // Emails, incl. "name at gmail dot com".
  { type: "email", re: /\b[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}\b/gi },
  { type: "email", re: /\b[a-z0-9._%+-]+\s*(?:@|\(at\)|\bat\b)\s*[a-z0-9.-]+\s*(?:\.|\bdot\b)\s*[a-z]{2,}\b/gi },
  // URLs / domains.
  { type: "url", re: /\b(?:https?:\/\/|www\.)\S+/gi },
  { type: "url", re: /\b[a-z0-9-]+\.(?:com|net|org|io|co|me|link|ly|app)\b/gi },
  // Phone numbers: 7+ digits with common separators, or intl +country.
  { type: "phone", re: /(?:\+?\d[\s().-]*){7,}\d/g },
  // Spelled-out phone numbers: 7+ number-words in a row.
  { type: "phone", re: new RegExp(`(?:\\b${NUMBER_WORDS}\\b[\\s,.-]*){7,}`, "gi") },
  // Social platforms + a handle-ish token nearby.
  {
    type: "social",
    re: /\b(?:insta(?:gram)?|ig|tik\s?tok|snap(?:chat)?|whats\s?app|wa|telegram|tg|fb|facebook|messenger|cash\s?app|venmo)\b/gi,
  },
  // @handles.
  { type: "handle", re: /(?:^|\s)@[a-z0-9_.]{2,}/gi },
];

// "gmail dot com", "dot com", "at gmail" style evasions (flagged separately).
const EVASION = /\b(?:dot|at)\b\s+(?:com|net|org|gmail|yahoo|icloud|hotmail|outlook)\b/gi;

export function scanForContactInfo(text: string): GuardResult {
  const found = new Set<ContactViolation>();
  let redacted = text;

  // Fresh regex per call — module-level /g regexes carry lastIndex state,
  // so we clone with `new RegExp` and use match/replace (not stateful .test).
  const check = (type: ContactViolation, re: RegExp) => {
    const clone = new RegExp(re.source, re.flags);
    if (clone.test(text)) {
      found.add(type);
      redacted = redacted.replace(new RegExp(re.source, re.flags), "▇▇▇");
    }
  };

  for (const { type, re } of PATTERNS) check(type, re);
  check("evasion", EVASION);

  const violations = VIOLATION_ORDER.filter((v) => found.has(v));
  return { blocked: violations.length > 0, violations, redacted };
}

const REASONS: Record<ContactViolation, string> = {
  phone: "phone numbers",
  email: "email addresses",
  url: "links",
  social: "social media",
  handle: "usernames",
  evasion: "contact details",
};

/** Friendly message explaining why a pre-payment message was blocked. */
export function guardMessage(result: GuardResult): string {
  const list = [...result.violations].map((v) => REASONS[v]);
  const unique = Array.from(new Set(list));
  const phrase = unique.length === 1 ? unique[0] : `${unique.slice(0, -1).join(", ")} and ${unique.at(-1)}`;
  return `For your safety, ${phrase} can't be shared until your booking is confirmed and paid. Keep the conversation in iGlamHer.`;
}
