import "server-only";
// Stripe Connect — provider payout onboarding. Real integration path; requires a
// live Stripe account with Connect enabled. Payout eligibility is derived from
// Stripe's own account flags (charges_enabled / payouts_enabled / details_submitted),
// never self-reported — and mirrored onto professional_profiles for fast checks.
//
// EXPRESS accounts: Stripe hosts onboarding (bank + identity + W-9 tax info) and
// handles KYC + the connected account's 1099 tax forms. The pro completes a short
// Stripe-hosted flow and returns to the app.
import type Stripe from "stripe";
import { getStripe, isStripeConfigured } from "./stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { publicEnv } from "@/lib/env";

export interface ConnectStatus {
  accountId: string | null;
  detailsSubmitted: boolean;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  eligibleForPayout: boolean; // payouts enabled AND not frozen
  /** Stripe requirements.currently_due — fields still blocking verification/payout. */
  currentlyDue: string[];
}

export const NOT_CONFIGURED: ConnectStatus = {
  accountId: null, detailsSubmitted: false, chargesEnabled: false, payoutsEnabled: false, eligibleForPayout: false, currentlyDue: [],
};

// Beauty/barber shops MCC — set on the Connect business_profile so the account
// isn't stuck in "currently_due" for merchant category + business URL. Stripe rejects
// non-HTTPS URLs (e.g. http://localhost during local dev), so fall back to the
// canonical production URL when the app URL isn't a public HTTPS origin.
const PUBLIC_HTTPS_URL = publicEnv.NEXT_PUBLIC_APP_URL.startsWith("https://")
  ? publicEnv.NEXT_PUBLIC_APP_URL
  : "https://iglamher.com";
const BUSINESS_PROFILE = { mcc: "7230", url: PUBLIC_HTTPS_URL } as const;

/** True when the current STRIPE_SECRET_KEY is a live-mode key. A test key (or any
 *  non-live key) is treated as test mode. Used to reject a stored account minted in
 *  the other mode, which is what triggers Stripe's
 *  "test mode account link for an account created in live mode" error. */
function currentKeyIsLive(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY?.startsWith("sk_live_"));
}

/** Stripe's Account type omits `livemode` even though every account carries it at
 *  runtime — read it through a narrow cast. */
function accountIsLive(acct: Stripe.Account): boolean {
  return Boolean((acct as { livemode?: boolean }).livemode);
}

/** Drop a stale/wrong-mode Connect account id so the next ensure/sync mints a fresh
 *  one in the current mode instead of surfacing the other mode's requirements. */
export async function clearStoredAccount(professionalId: string): Promise<void> {
  const admin = createAdminClient();
  await admin.from("professional_profiles").update({
    stripe_account_id: null,
    connect_details_submitted: false,
    connect_charges_enabled: false,
    connect_payouts_enabled: false,
    connect_onboarded_at: null,
  }).eq("user_id", professionalId);
}

/** Mint a fresh Express account in the current mode and persist its id. */
async function createExpressAccount(professionalId: string, email?: string): Promise<string> {
  const stripe = await getStripe();
  const account = await stripe.accounts.create({
    type: "express",
    email,
    business_type: "individual",
    business_profile: { ...BUSINESS_PROFILE },
    // Payout-only: the platform charges customers, then transfers to the pro.
    capabilities: { transfers: { requested: true }, card_payments: { requested: true } },
    metadata: { professionalId },
  });
  const admin = createAdminClient();
  await admin.from("professional_profiles").update({ stripe_account_id: account.id }).eq("user_id", professionalId);
  return account.id;
}

/** Create (or reuse) the professional's Connect EXPRESS account. Self-healing: a
 *  stored account that no longer matches the current Stripe mode (test vs live) or
 *  is the legacy Custom type is discarded and replaced with a fresh Express account,
 *  instead of failing with "test mode link for a live mode account". */
export async function ensureConnectAccount(professionalId: string, email?: string): Promise<string> {
  const admin = createAdminClient();
  const { data } = await admin.from("professional_profiles").select("stripe_account_id").eq("user_id", professionalId).maybeSingle();
  const existing = (data as { stripe_account_id?: string } | null)?.stripe_account_id;
  const stripe = await getStripe();
  const keyIsLive = currentKeyIsLive();

  if (existing) {
    try {
      const acct = await stripe.accounts.retrieve(existing);
      // Reuse only if it's an Express account minted in the CURRENT key's mode.
      // A live account under test keys (or vice-versa) causes the test/live link
      // mismatch, so discard it and mint fresh below.
      if (acct.type === "express" && accountIsLive(acct) === keyIsLive) return existing;
    } catch {
      // Not retrievable in the current mode (wrong test/live mode, or deleted) —
      // fall through, clear the stale id, and mint a fresh account below.
    }
    await clearStoredAccount(professionalId);
  }

  return createExpressAccount(professionalId, email);
}

/** Hosted Stripe onboarding link — the pro enters bank + identity + tax info and
 *  completes verification on Stripe, then returns to /pro/earnings. */
export async function createOnboardingLink(accountId: string): Promise<string> {
  const stripe = await getStripe();
  // Stripe rejects non-HTTPS (localhost) return/refresh URLs, so use the HTTPS origin.
  const link = await stripe.accountLinks.create({
    account: accountId,
    type: "account_onboarding",
    refresh_url: `${PUBLIC_HTTPS_URL}/pro/earnings?refresh=1`,
    return_url: `${PUBLIC_HTTPS_URL}/pro/earnings?done=1`,
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
  const keyIsLive = currentKeyIsLive();
  let acct: Stripe.Account;
  try {
    acct = await stripe.accounts.retrieve(row.stripe_account_id);
  } catch {
    // Stored id isn't retrievable under the current key (wrong mode / deleted) —
    // clear it so the UI stops showing the other mode's currently_due list.
    await clearStoredAccount(professionalId);
    return NOT_CONFIGURED;
  }
  // A live account read under test keys (or vice-versa) reports the OTHER mode's
  // requirements. Drop it rather than render those under the current mode.
  if (accountIsLive(acct) !== keyIsLive) {
    await clearStoredAccount(professionalId);
    return NOT_CONFIGURED;
  }
  const detailsSubmitted = Boolean(acct.details_submitted);
  const chargesEnabled = Boolean(acct.charges_enabled);
  const payoutsEnabled = Boolean(acct.payouts_enabled);
  const eligibleForPayout = payoutsEnabled && !row.payouts_frozen;
  // Fields Stripe still needs before it will verify/release payouts. Surfaced in
  // the UI so a stuck pro knows exactly what's outstanding instead of "in review".
  const currentlyDue = acct.requirements?.currently_due ?? [];

  await admin.from("professional_profiles").update({
    connect_details_submitted: detailsSubmitted,
    connect_charges_enabled: chargesEnabled,
    connect_payouts_enabled: payoutsEnabled,
    connect_onboarded_at: payoutsEnabled ? new Date().toISOString() : null,
  }).eq("user_id", professionalId);

  return { accountId: row.stripe_account_id, detailsSubmitted, chargesEnabled, payoutsEnabled, eligibleForPayout, currentlyDue };
}
