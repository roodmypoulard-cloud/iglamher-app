// Central registry of external integrations. Every vendor-dependent feature
// checks here first. `integrationStatus()` powers the admin "Integrations" panel
// so you can see at a glance what's wired vs. waiting on an API key.

export type IntegrationKey =
  | "supabase"
  | "stripe"
  | "google_oauth"
  | "openai_search"
  | "resend_email"
  | "twilio_sms"
  | "push_fcm"
  | "push_apns"
  | "persona_identity"
  | "stripe_identity"
  | "fingerprint_fraud"
  | "sentry";

interface IntegrationMeta {
  key: IntegrationKey;
  label: string;
  category: "core" | "ai" | "messaging" | "trust" | "observability";
  envVars: string[];
  configured: () => boolean;
  purpose: string;
}

const has = (...vars: string[]) => vars.every((v) => Boolean(process.env[v]));

export const INTEGRATIONS: IntegrationMeta[] = [
  { key: "supabase", label: "Supabase", category: "core", envVars: ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"], configured: () => has("NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY") && !process.env.NEXT_PUBLIC_SUPABASE_URL!.includes("placeholder"), purpose: "Database, auth, storage, realtime" },
  { key: "stripe", label: "Stripe", category: "core", envVars: ["STRIPE_SECRET_KEY"], configured: () => has("STRIPE_SECRET_KEY"), purpose: "Payments & payouts" },
  { key: "google_oauth", label: "Google Sign-In", category: "core", envVars: ["(Supabase dashboard)"], configured: () => true, purpose: "Social login (configured in Supabase)" },
  { key: "openai_search", label: "OpenAI (semantic search)", category: "ai", envVars: ["OPENAI_API_KEY"], configured: () => has("OPENAI_API_KEY"), purpose: "Embeddings for natural-language search" },
  { key: "resend_email", label: "Resend (email)", category: "messaging", envVars: ["RESEND_API_KEY"], configured: () => has("RESEND_API_KEY"), purpose: "Transactional email" },
  { key: "twilio_sms", label: "Twilio (SMS)", category: "messaging", envVars: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"], configured: () => has("TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN", "TWILIO_FROM_NUMBER"), purpose: "SMS notifications" },
  { key: "push_fcm", label: "Firebase (Android push)", category: "messaging", envVars: ["FCM_SERVER_KEY"], configured: () => has("FCM_SERVER_KEY"), purpose: "Android push notifications" },
  { key: "push_apns", label: "APNs (iOS push)", category: "messaging", envVars: ["APNS_KEY_ID", "APNS_TEAM_ID", "APNS_PRIVATE_KEY"], configured: () => has("APNS_KEY_ID", "APNS_TEAM_ID", "APNS_PRIVATE_KEY"), purpose: "iOS push notifications" },
  { key: "persona_identity", label: "Persona (ID verify)", category: "trust", envVars: ["PERSONA_API_KEY"], configured: () => has("PERSONA_API_KEY"), purpose: "Government ID + selfie verification" },
  { key: "stripe_identity", label: "Stripe Identity", category: "trust", envVars: ["STRIPE_SECRET_KEY"], configured: () => has("STRIPE_SECRET_KEY"), purpose: "Alt. ID + selfie verification" },
  { key: "fingerprint_fraud", label: "FingerprintJS", category: "trust", envVars: ["FINGERPRINT_API_KEY"], configured: () => has("FINGERPRINT_API_KEY"), purpose: "Device fingerprinting for fraud" },
  { key: "sentry", label: "Sentry", category: "observability", envVars: ["SENTRY_DSN"], configured: () => has("SENTRY_DSN"), purpose: "Error tracking" },
];

export function isConfigured(key: IntegrationKey): boolean {
  return INTEGRATIONS.find((i) => i.key === key)?.configured() ?? false;
}

export interface IntegrationStatus {
  key: IntegrationKey;
  label: string;
  category: string;
  configured: boolean;
  envVars: string[];
  purpose: string;
}

export function integrationStatus(): IntegrationStatus[] {
  return INTEGRATIONS.map((i) => ({
    key: i.key,
    label: i.label,
    category: i.category,
    configured: i.configured(),
    envVars: i.envVars,
    purpose: i.purpose,
  }));
}
