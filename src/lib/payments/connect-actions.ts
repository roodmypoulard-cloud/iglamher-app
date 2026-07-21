"use server";
// Provider payout onboarding actions. Gated on a professional account + live Stripe.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { isStripeConfigured } from "./stripe";
import { ensureConnectAccount, createOnboardingLink, syncConnectStatus, type ConnectStatus, NOT_CONFIGURED } from "./connect";

export type ConnectResult = { ok: true; url: string } | { ok: false; error: string };

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

export async function startConnectOnboardingAction(): Promise<ConnectResult> {
  const gate = await requirePro();
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    const accountId = await ensureConnectAccount(gate.userId, gate.email);
    const url = await createOnboardingLink(accountId);
    return { ok: true, url };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Could not start onboarding." };
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
