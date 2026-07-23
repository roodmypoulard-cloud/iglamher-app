import "server-only";
// Single source of truth for resolving a user's Stripe customer + saved cards.
// Shared by account-level card management (payment-methods.ts) and one-off
// off-session charges (checkout, tips, balance holds). We ALWAYS reuse the
// persisted profiles.stripe_customer_id first and only create a Stripe customer
// as a last resort — so a user never accumulates orphan duplicate customers.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "./stripe";

type ServerClient = Awaited<ReturnType<typeof createSupabaseServerClient>>;
type Admin = ReturnType<typeof createAdminClient>;

/** Read the persisted Stripe customer id from profiles (best-effort — column may not exist yet). */
export async function readCustomerId(supabase: ServerClient, userId: string): Promise<string | null> {
  try {
    const { data } = await supabase.from("profiles").select("stripe_customer_id").eq("id", userId).maybeSingle();
    return (data as { stripe_customer_id?: string | null } | null)?.stripe_customer_id ?? null;
  } catch {
    return null;
  }
}

/** Persist the resolved customer id on the user's profile (service-role write). */
export async function persistCustomerId(userId: string, customerId: string): Promise<void> {
  try {
    // stripe_customer_id is service-role-only (a user must not be able to PATCH
    // their own row to point at someone else's Stripe customer), so write it via
    // the admin client rather than the caller's session.
    await createAdminClient().from("profiles").update({ stripe_customer_id: customerId }).eq("id", userId);
  } catch {
    /* column may not exist yet (migration 0022 not applied) — non-fatal */
  }
}

/** Find the user's existing Stripe customer without creating one. Returns null if none. */
export async function findCustomerId(
  supabase: ServerClient,
  userId: string,
  email?: string | null,
): Promise<string | null> {
  const persisted = await readCustomerId(supabase, userId);
  if (persisted) return persisted;
  const stripe = await getStripe();
  // Fall back to a metadata search (covers the case where the column isn't applied).
  try {
    const found = await stripe.customers.search({ query: `metadata['userId']:'${userId}'`, limit: 1 });
    if (found.data[0]) {
      await persistCustomerId(userId, found.data[0].id);
      return found.data[0].id;
    }
  } catch {
    /* search may be unavailable — fall through */
  }
  void email;
  return null;
}

/** Get or create the user's Stripe customer. */
export async function getOrCreateCustomerId(
  supabase: ServerClient,
  userId: string,
  email?: string | null,
): Promise<string> {
  const existing = await findCustomerId(supabase, userId, email);
  if (existing) return existing;
  const stripe = await getStripe();
  const customer = await stripe.customers.create({
    email: email ?? undefined,
    metadata: { userId },
  });
  await persistCustomerId(userId, customer.id);
  return customer.id;
}

/** Resolve the customer's chargeable default card: Stripe invoice default, else newest card. */
async function resolveCustomerDefaultPaymentMethodId(customerId: string): Promise<string | null> {
  const stripe = await getStripe();
  try {
    const customer = await stripe.customers.retrieve(customerId);
    if (!("deleted" in customer)) {
      const d = customer.invoice_settings?.default_payment_method;
      const id = typeof d === "string" ? d : d?.id ?? null;
      if (id) return id;
    }
    const methods = await stripe.paymentMethods.list({ customer: customerId, type: "card", limit: 1 });
    return methods.data[0]?.id ?? null;
  } catch {
    return null;
  }
}

/**
 * Resolve a chargeable (customerId, paymentMethodId) for an off-session charge on
 * a booking. Prefers the card saved on the booking, then falls back to the user's
 * account-level default card (profiles.stripe_default_payment_method_id, else the
 * customer's Stripe default / newest card). Returns null when nothing is chargeable.
 */
export async function resolveChargeIdentity(
  admin: Admin,
  opts: { userId: string; bookingCustomerId?: string | null; bookingPaymentMethodId?: string | null },
): Promise<{ customerId: string; paymentMethodId: string } | null> {
  let customerId = opts.bookingCustomerId ?? null;
  let paymentMethodId = opts.bookingPaymentMethodId ?? null;
  if (customerId && paymentMethodId) return { customerId, paymentMethodId };

  // Fall back to the account-level saved customer + default card.
  try {
    const { data } = await admin
      .from("profiles")
      .select("stripe_customer_id, stripe_default_payment_method_id")
      .eq("id", opts.userId)
      .maybeSingle();
    const prof = data as
      | { stripe_customer_id?: string | null; stripe_default_payment_method_id?: string | null }
      | null;
    customerId = customerId ?? prof?.stripe_customer_id ?? null;
    paymentMethodId = paymentMethodId ?? prof?.stripe_default_payment_method_id ?? null;
  } catch {
    /* profiles columns optional (migration 0022) — fall through with what we have */
  }

  if (!customerId) return null;
  if (!paymentMethodId) paymentMethodId = await resolveCustomerDefaultPaymentMethodId(customerId);
  if (!paymentMethodId) return null;
  return { customerId, paymentMethodId };
}
