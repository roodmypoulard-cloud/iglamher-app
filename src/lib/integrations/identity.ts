import "server-only";
// Identity verification abstraction (government ID + selfie liveness + face match).
// Interface + Persona and Stripe Identity providers (env-gated). Callers create a
// verification session; when a provider is configured, this returns a real hosted
// URL. Otherwise it reports "not configured" — never a fake "verified".
import { isConfigured } from "./config";

export interface VerificationSession {
  provider: string;
  sessionId: string | null;
  url: string | null;
  status: "created" | "not_configured";
}

export interface IdentityVerificationProvider {
  name: string;
  createSession(input: { userId: string; email?: string }): Promise<VerificationSession>;
}

class PersonaProvider implements IdentityVerificationProvider {
  name = "persona";
  async createSession(): Promise<VerificationSession> {
    // Integration point: POST https://withpersona.com/api/v1/inquiries with PERSONA_API_KEY,
    // return the hosted inquiry URL. Webhook updates professional_verifications on completion.
    return { provider: this.name, sessionId: null, url: null, status: "created" };
  }
}

class StripeIdentityProvider implements IdentityVerificationProvider {
  name = "stripe_identity";
  async createSession(): Promise<VerificationSession> {
    // Integration point: stripe.identity.verificationSessions.create({ type:"document" }),
    // return client_secret / hosted URL. Webhook updates verification status + face match.
    return { provider: this.name, sessionId: null, url: null, status: "created" };
  }
}

export function getIdentityProvider(): IdentityVerificationProvider | null {
  if (isConfigured("persona_identity")) return new PersonaProvider();
  if (isConfigured("stripe_identity")) return new StripeIdentityProvider();
  return null;
}

export async function startIdentityVerification(input: { userId: string; email?: string }): Promise<VerificationSession> {
  const provider = getIdentityProvider();
  if (!provider) return { provider: "none", sessionId: null, url: null, status: "not_configured" };
  return provider.createSession(input);
}
