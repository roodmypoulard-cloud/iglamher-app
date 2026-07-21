import "server-only";
// Stripe Connect — provider payout onboarding. Real integration path; requires a
// live Stripe account with Connect enabled. Payout eligibility is derived from
// Stripe's own account flags (charges_enabled / payouts_enabled / details_submitted),
// never self-reported — and mirrored onto professional_profiles for fast checks.
import { getStripe, isStripeConfigured } from "./stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export interface ConnectStatus {
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  eligibleForPayout: boolean; // payouts enabled AND not frozen
}

export const NOT_CONFIGURED: ConnectStatus = {
  accountId: null, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, eligibleForPayout: false,
};

/** Create (or reuse) the professional's Connect Express account. */
export async function ensureConnectAccount(professionalId: string, email?: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("professional_profiles").select("stripe_account_id").eq("user_id", professionalId).maybeSingle();
  const existing = (data as { stripe_account_id?: string } | null)?.stripe_account_id;
  if (existing) return existing;

  const stripe = await getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    email,
    capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    business_type: "individual",
    metadata: { professionalId },
  });
  await admin.from("professional_profiles").update({ stripe_account_id: account.id }).eq("user_id", professionalId);
  return account.id;
}

/** Hosted onboarding link for the professional to complete verification. */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const stripe = await getStripe();
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/pro/payouts?refresh=1`,
    return_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/pro/payouts?done=1`,
  });
  return link.url;
}

/** Pull the account's true status from Stripe and mirror it locally. */
export async function syncConnectStatus(professionalId: string): Promise<ConnectStatus> {
  if (!isStripeConfigured()) return NOT_CONFIGURED;
  const admin = createAdminClient();
  const { data } = await admin.from("professional_profiles").select("stripe_account_id, payouts_frozen").eq("user_id", professionalId).maybeSingle();
  const row = data as { stripe_account_id?: string; payouts_frozen?: boolean } | null;
  if (!row?.stripe_account_id) return NOT_CONFIGURED;

  const stripe = await getStripe();
  const acct = await stripe.accounts.retrieve(row.stripe_account_id);
  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);
  const eligibleForPayout = payoutsEnabled && !row.payouts_frozen;

  await admin.from("professional_profiles").update({
    connect_details_submitted: detailsSubmitted,
    connect_charges_enabled: chargesEnabled,
    connect_payouts_enabled: payoutsEnabled,
    connect_onboarded_at: payoutsEnabled ? new Date().toISOString() : null,
  }).eq("user_id", professionalId);

  return { accountId: row.stripe_account_id, detailsSubmitted, chargesEnabled, payoutsEnabled, eligibleForPayout };
}
