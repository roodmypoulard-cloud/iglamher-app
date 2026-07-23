"use server";
// Provider payout onboarding actions. Gated on a professional account + live Stripe.
// Express Connect: the pro completes bank + identity + tax info on Stripe's hosted
// onboarding page, then returns to the app. Stripe owns KYC and the 1099 tax forms.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { isStripeConfigured } from "./stripe";
import { ensureConnectAccount, createOnboardingLink, clearStoredAccount, syncConnectStatus, type ConnectStatus, NOT_CONFIGURED } from "./connect";

export type ConnectResult = { ok: true; url: string } | { ok: false; error: string };

/** Stripe raises this when a stored account id belongs to the other key mode
 *  (test id under live keys, or vice-versa) — the exact failure we self-heal. */
function isModeMismatch(e: unknown): boolean {
  const msg = e instanceof Error ? e.message.toLowerCase() : String(e).toLowerCase();
  return (msg.includes("test mode") || msg.includes("live mode")) &&
    (msg.includes("account link") || msg.includes("account that was created") || msg.includes("similar object"));
}

async function requirePro(): Promise<{ error: string } | { userId: string; email?: string }> {
  if (!isLiveSupabase()) return { error: "Connect the backend to set up payouts." };
  if (!isStripeConfigured()) return { error: "Payments are not enabled yet." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "professional" && role !== "admin") return { error: "Professional account required." };
  return { userId: auth.user.id, email: auth.user.email ?? undefined };
}

/** Create/reuse the pro's Express account and return a Stripe-hosted onboarding URL. */
export async function startConnectOnboardingAction(): Promise<ConnectResult> {
  const gate = await requirePro();
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    const accountId = await ensureConnectAccount(gate.userId, gate.email);
    const url = await createOnboardingLink(accountId);
    return { ok: true, url };
  } catch (e) {
    // A wrong-mode stored account survives ensureConnectAccount only if Stripe still
    // returns it as an Express account whose livemode "matched" — belt-and-suspenders:
    // if the link create trips the test/live mismatch, drop the id and retry once with
    // a freshly minted current-mode account.
    if (isModeMismatch(e)) {
      try {
        await clearStoredAccount(gate.userId);
        const accountId = await ensureConnectAccount(gate.userId, gate.email);
        const url = await createOnboardingLink(accountId);
        return { ok: true, url };
      } catch (retryErr) {
        console.error("[payouts] startConnectOnboarding retry failed", retryErr instanceof Error ? retryErr.message : retryErr);
        return { ok: false, error: "Could not start payout onboarding. Please try again in a moment." };
      }
    }
    console.error("[payouts] startConnectOnboarding failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not start payout onboarding. Please try again in a moment." };
  }
}

export async function refreshConnectStatusAction(): Promise<ConnectStatus> {
  const gate = await requirePro();
  if ("error" in gate) return NOT_CONFIGURED;
  try {
    return await syncConnectStatus(gate.userId);
  } catch {
    return NOT_CONFIGURED;
  }
}
