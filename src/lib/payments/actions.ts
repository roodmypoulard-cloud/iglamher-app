"use server";
// Stripe Checkout for a booking's deposit/total. Server-authoritative: the amount
// is read from the persisted booking (never the client). Returns a hosted Checkout
// URL the client redirects to. On success, /book/success confirms the booking;
// the webhook is the production reconciliation path (idempotent).
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getStripe, isStripeConfigured } from "./stripe";
import { publicEnv } from "@/lib/env";

export type CheckoutResult = { ok: true; url: string } | { ok: false; error: string; needsAuth?: true };

export async function createCheckoutSessionAction(bookingId: string): Promise<CheckoutResult> {
  if (!isLiveSupabase()) return { ok: false, error: "Payments require the live backend." };
  if (!isStripeConfigured()) return { ok: false, error: "Payments are not enabled yet." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in to pay.", needsAuth: true };

  // Read the booking authoritatively — must belong to this customer and be unpaid.
  const { data: booking } = await supabase
    .from("bookings")
    .select("id, customer_id, professional_id, status, amount_due_now_cents, service_name_snapshot")
    .eq("id", bookingId)
    .maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };
  const b = booking as {
    id: string; customer_id: string; professional_id: string; status: string;
    amount_due_now_cents: number; service_name_snapshot: string;
  };
  if (b.customer_id !== auth.user.id) return { ok: false, error: "Not your booking." };
  if (b.status !== "pending_payment") return { ok: false, error: "This booking is not awaiting payment." };

  // NOTE: destination-charge split to the stylist's connected account is added
  // once professionals complete Stripe Connect onboarding. Until then the deposit
  // is captured to the platform and reconciled on payout.
  try {
    const stripe = await getStripe();
    const session = await stripe.checkout.sessions.create({
      mode: "payment",
      line_items: [
        {
          price_data: {
            currency: "usd",
            product_data: { name: `iGlamHer — ${b.service_name_snapshot}` },
            unit_amount: b.amount_due_now_cents,
          },
          quantity: 1,
        },
      ],
      metadata: { bookingId: b.id },
      // Save the card so we can hold + charge the remaining balance on the day of
      // the job (deposit is captured now; balance is authorized at "Start").
      customer_creation: "always",
      payment_intent_data: { metadata: { bookingId: b.id }, setup_future_usage: "off_session" },
      customer_email: auth.user.email ?? undefined,
      success_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/book/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${publicEnv.NEXT_PUBLIC_APP_URL}/account`,
    });
    if (!session.url) return { ok: false, error: "Could not start checkout." };
    return { ok: true, url: session.url };
  } catch (e) {
    // Never crash the page on a Stripe error — surface a clear, catchable message.
    const msg = e instanceof Error ? e.message : "Payment could not be started.";
    return { ok: false, error: msg };
  }
}
