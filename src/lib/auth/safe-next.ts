// Hardened post-auth redirect target.
//
// A bare `next.startsWith("/")` check is not sufficient: a protocol-relative
// path such as `//evil.com` (or `/\evil.com`, which browsers normalise to the
// same thing) passes it, and the browser resolves the emitted Location header
// to an external origin. Because the flow begins on the real domain, that is a
// strong phishing primitive.
//
// A safe target is a path that starts with exactly one slash, is not followed
// by another slash or backslash, and carries no scheme.

const DEFAULT_NEXT = "/discover";

const HAS_SCHEME = /^\/+[a-z][a-z0-9+.-]*:/i;

// Control characters (including encoded CR/LF) can smuggle header content.
// Expressed as char codes rather than a literal regex class so the source
// contains no control bytes of its own.
function hasControlChars(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 0x1f || code === 0x7f) return true;
  }
  return false;
}

export function safeNext(value: unknown, fallback: string = DEFAULT_NEXT): string {
  if (typeof value !== "string" || value.length === 0) return fallback;

  // Reject anything the browser could read as an authority or a scheme.
  if (!value.startsWith("/")) return fallback;
  if (value.startsWith("//")) return fallback;
  if (value.includes("\\")) return fallback;
  if (HAS_SCHEME.test(value)) return fallback;
  if (hasControlChars(value)) return fallback;

  return value;
}
