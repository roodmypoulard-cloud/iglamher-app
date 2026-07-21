import "server-only";
import type Stripe from "stripe";
// Stripe Connect integration surface. The SDK is loaded lazily and only when
// STRIPE_SECRET_KEY is present, so the app builds and runs without Stripe
// configured. Every function that needs Stripe throws a clear, catchable error
// when it isn't — we never pretend a charge succeeded.

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

let cached: Stripe | null = null;

export async function getStripe(): Promise<Stripe> {
  if (!isStripeConfigured()) {
    throw new Error("Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments.");
  }
  if (cached) return cached;
  const { default: StripeCtor } = await import("stripe").catch(() => {
    throw new Error("The 'stripe' package is not installed. Run: npm i stripe");
  });
  cached = new StripeCtor(process.env.STRIPE_SECRET_KEY as string);
  return cached;
}

export interface CheckoutIntentInput {
  amountCents: number;
  currency?: string;
  bookingId: string;
  customerId: string;
  professionalStripeAccountId?: string | null;
  applicationFeeCents: number; // platform commission
}

/**
 * Create a PaymentIntent that routes the funds to the professional's connected
 * account and takes the platform commission as an application fee (Stripe
 * Connect "destination charge"). Requires a live Stripe account + connected pro.
 */
export async function createBookingPaymentIntent(input: CheckoutIntentInput): Promise<{ id: string; clientSecret: string | null }> {
  const stripe = await getStripe();
  const pi = await stripe.paymentIntents.create({
    amount: input.amountCents,
    currency: input.currency ?? "usd",
    automatic_payment_methods: { enabled: true }, // Apple Pay / Google Pay / cards
    metadata: { bookingId: input.bookingId, customerId: input.customerId },
    ...(input.professionalStripeAccountId
      ? {
          application_fee_amount: input.applicationFeeCents,
          transfer_data: { destination: input.professionalStripeAccountId },
        }
      : {}),
  });
  return { id: pi.id, clientSecret: pi.client_secret };
}
