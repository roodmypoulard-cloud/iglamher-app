// Lightweight analytics. Privacy rule: NEVER pass addresses, message bodies,
// payment/identity data, or precise coordinates. Only IDs, slugs, and coarse facets.
// In dev this logs to the console; wire to a real sink (PostHog/GA) behind this API.

export type AnalyticsEvent =
  | "booking_page_viewed"
  | "recommendations_viewed"
  | "search_submitted"
  | "filter_applied"
  | "category_viewed"
  | "professional_viewed"
  | "service_viewed"
  | "favorite_added"
  | "favorite_removed"
  | "availability_preview_opened"
  | "booking_started"
  | "checkout_started"
  | "booking_confirmed";

export type AnalyticsProps = Record<string, string | number | boolean | undefined>;

const SENSITIVE = /(address|lat|lng|coord|email|phone|message|card|token|secret)/i;

function sanitize(props: AnalyticsProps): AnalyticsProps {
  const out: AnalyticsProps = {};
  for (const [k, v] of Object.entries(props)) {
    if (SENSITIVE.test(k)) continue; // drop anything sensitive by key name
    if (v !== undefined) out[k] = v;
  }
  return out;
}

export function track(event: AnalyticsEvent, props: AnalyticsProps = {}): void {
  const payload = sanitize(props);
  if (typeof window !== "undefined") {
    // Placeholder sink. Replace with real client SDK call.
    console.debug(`[analytics] ${event}`, payload);
  }
}
