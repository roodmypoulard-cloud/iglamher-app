"use server";
// Account-level saved cards via Stripe SetupIntent. Card details never touch our
// servers — Stripe Elements tokenizes them client-side; we only ever handle the
// Stripe customer + payment-method IDs. Every mutation verifies the payment
// method belongs to the signed-in user's customer before acting.
import type { User } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { getStripe, isStripeConfigured } from "./stripe";
import { findCustomerId, getOrCreateCustomerId } from "./customer";
import { withTimeout } from "@/lib/util/timeout";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;

export interface SavedCard {
  id: string;
  brand: string; // "visa" | "mastercard" | ...
  last4: string;
  expMonth: number;
  expYear: number;
  isDefault: boolean;
}

async function requireUser(): Promise<{ error: string } | { supabase: ServerClient; user: User }> {
  if (!isLiveSupabase()) return { error: "Payments are not available in this environment." };
  if (!isStripeConfigured()) return { error: "Payments are temporarily unavailable." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Please sign in." };
  return { supabase, user: data.user };
}

/** Step 1 — create a SetupIntent so the client can collect + save a card. */
export async function createSetupIntentAction(): Promise<
  { clientSecret: string; publishableKey: string } | { error: string }
> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  const publishableKey = process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY;
  if (!publishableKey) return { error: "Payments are temporarily unavailable." };
  try {
    const customerId = await getOrCreateCustomerId(gate.supabase, gate.user.id, gate.user.email);
    const stripe = await getStripe();
    const si = await stripe.setupIntents.create({
      customer: customerId,
      payment_method_types: ["card"],
      usage: "off_session", // saved for future balance holds / tips
    });
    if (!si.client_secret) return { error: "Could not start card setup. Please try again." };
    return { clientSecret: si.client_secret, publishableKey };
  } catch (e) {
    console.error("[payment-methods.setupIntent] failed", e instanceof Error ? e.message : e);
    return { error: "Could not start card setup. Please try again." };
  }
}

/** List the user's saved cards, newest first, with the default flagged. */
export async function listMyCardsAction(): Promise<{ cards: SavedCard[] } | { error: string }> {
  const gate = await requireUser();
  if ("error" in gate) return { error: gate.error };
  try {
    const customerId = await findCustomerId(gate.supabase, gate.user.id, gate.user.email);
    if (!customerId) return { cards: [] };
    const stripe = await getStripe();
    const [methods, customer] = await withTimeout(
      Promise.all([
        stripe.paymentMethods.list({ customer: customerId, type: "card" }),
        stripe.customers.retrieve(customerId),
      ]),
      8000,
      "list cards",
    );
    const defaultId =
      !("deleted" in customer) && typeof customer.invoice_settings?.default_payment_method === "string"
        ? customer.invoice_settings.default_payment_method
        : null;

    // Dedupe: saving the same physical card twice creates two PaymentMethods
    // with the same card fingerprint. Keep one per fingerprint — prefer the
    // default, else the oldest — and detach the extras (best-effort, so a
    // detach failure never breaks listing).
    const keepByFingerprint = new Map<string, (typeof methods.data)[number]>();
    const dupes: string[] = [];
    for (const m of [...methods.data].sort((a, b) => a.created - b.created)) {
      const fp = m.card?.fingerprint;
      if (!fp) continue;
      const kept = keepByFingerprint.get(fp);
      if (!kept) keepByFingerprint.set(fp, m);
      else if (m.id === defaultId) {
        dupes.push(kept.id);
        keepByFingerprint.set(fp, m);
      } else dupes.push(m.id);
    }
    if (dupes.length) {
      await Promise.allSettled(dupes.map((id) => stripe.paymentMethods.detach(id)));
      methods.data = methods.data.filter((m) => !dupes.includes(m.id));
    }

    const cards: SavedCard[] = methods.data
      .filter((m) => m.card)
      .map((m) => ({
        id: m.id,
        brand: m.card!.brand,
        last4: m.card!.last4,
        expMonth: m.card!.exp_month,
        expYear: m.card!.exp_year,
        isDefault: m.id === defaultId,
      }));
    // First card with no explicit default → treat the newest as default.
    if (cards.length > 0 && !cards.some((c) => c.isDefault)) cards[0].isDefault = true;
    return { cards };
  } catch (e) {
    console.error("[payment-methods.list] failed", e instanceof Error ? e.message : e);
    return { error: "Could not load your cards. Please try again." };
  }
}

/** Confirm a payment method belongs to this user's customer. */
async function assertOwnsMethod(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  userId: string,
  email: string | null | undefined,
  paymentMethodId: string,
): Promise<string | null> {
  const customerId = await findCustomerId(supabase, userId, email);
  if (!customerId) return null;
  const stripe = await getStripe();
  const pm = await stripe.paymentMethods.retrieve(paymentMethodId);
  return pm.customer === customerId ? customerId : null;
}

/**
 * Point the customer's default payment method at `paymentMethodId` (or clear it when
 * null), keeping Stripe's invoice_settings and our mirrored profiles column in sync.
 * Shared by setDefault and remove so both write the default the exact same way.
 */
async function writeDefault(customerId: string, userId: string, paymentMethodId: string | null): Promise<void> {
  const stripe = await getStripe();
  // Stripe clears the default when the field is an empty string.
  await stripe.customers.update(customerId, { invoice_settings: { default_payment_method: paymentMethodId ?? "" } });
  try {
    // Service-role-only column (see persistCustomerId) — write via the admin client.
    await createAdminClient().from("profiles").update({ stripe_default_payment_method_id: paymentMethodId }).eq("id", userId);
  } catch {
    /* column optional (migration 0022 may not be applied) */
  }
}

/** Read the customer's current default payment method id, if any. */
async function readDefaultMethodId(customerId: string): Promise<string | null> {
  const stripe = await getStripe();
  const customer = await stripe.customers.retrieve(customerId);
  if ("deleted" in customer) return null;
  const d = customer.invoice_settings?.default_payment_method;
  return typeof d === "string" ? d : d?.id ?? null;
}

/** Make a saved card the default for future off-session charges. */
export async function setDefaultCardAction(paymentMethodId: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    const customerId = await assertOwnsMethod(gate.supabase, gate.user.id, gate.user.email, paymentMethodId);
    if (!customerId) return { ok: false, error: "Card not found." };
    await writeDefault(customerId, gate.user.id, paymentMethodId);
    return { ok: true };
  } catch (e) {
    console.error("[payment-methods.setDefault] failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not update your default card." };
  }
}

/** Remove (detach) a saved card. */
export async function removeCardAction(paymentMethodId: string): Promise<{ ok: boolean; error?: string }> {
  const gate = await requireUser();
  if ("error" in gate) return { ok: false, error: gate.error };
  try {
    const customerId = await assertOwnsMethod(gate.supabase, gate.user.id, gate.user.email, paymentMethodId);
    if (!customerId) return { ok: false, error: "Card not found." };
    const stripe = await getStripe();

    // Was this the default? If so, we must not leave a dangling default pointing at a
    // detached card — clear it, or promote another saved card in its place.
    const wasDefault = (await readDefaultMethodId(customerId)) === paymentMethodId;

    await stripe.paymentMethods.detach(paymentMethodId);

    if (wasDefault) {
      const remaining = await stripe.paymentMethods.list({ customer: customerId, type: "card" });
      const next = remaining.data.find((m) => m.id !== paymentMethodId);
      // Promote the next card (newest first from Stripe) or clear the default entirely.
      await writeDefault(customerId, gate.user.id, next?.id ?? null);
    }
    return { ok: true };
  } catch (e) {
    console.error("[payment-methods.remove] failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "Could not remove that card." };
  }
}
