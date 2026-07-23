import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { getStripe, isStripeConfigured } from "@/lib/payments/stripe";
import { createAdminClient } from "@/lib/supabase/admin";
import { ensureBookingConversationUnlocked } from "@/lib/messaging/unlock";
import { isLiveSupabase } from "@/lib/data/source";
import { formatPrice } from "@/lib/format";

/** Stripe fields are `string | { id } | null` depending on expansion — normalise. */
function idOf(v: string | { id?: string } | null | undefined): string | null {
  if (!v) return null;
  return typeof v === "string" ? v : v.id ?? null;
}

export const dynamic = "force-dynamic";
export const metadata = { title: "Booking confirmed · iGlamHer" };

// Confirms a booking from a PAID Stripe session. The session id is proof of
// payment (same trust model as the webhook) — no browser auth needed, so it
// survives the cross-site return from Stripe's checkout domain.
async function confirmFromSession(sessionId: string) {
  const stripe = await getStripe();
  // Expand the PaymentIntent so we can read the customer + saved payment method —
  // these are what the day-of balance hold and tips charge off-session.
  const session = await stripe.checkout.sessions.retrieve(sessionId, { expand: ["payment_intent"] });
  const bookingId = session.metadata?.bookingId;
  if (session.payment_status !== "paid" || !bookingId) {
    return { paid: false as const };
  }

  const pi = session.payment_intent;
  const piId = idOf(pi as string | { id?: string } | null) ?? "";
  const customerId =
    idOf(session.customer as string | { id?: string } | null) ??
    (typeof pi === "object" && pi ? idOf(pi.customer as string | { id?: string } | null) : null);
  const paymentMethodId =
    typeof pi === "object" && pi ? idOf(pi.payment_method as string | { id?: string } | null) : null;

  const admin = createAdminClient();
  const { data: booking } = await admin
    .from("bookings")
    .select("id, customer_id, professional_id, status, total_cents, amount_due_now_cents, service_name_snapshot")
    .eq("id", bookingId)
    .maybeSingle();
  const b = booking as
    | { id: string; customer_id: string; professional_id: string; status: string; total_cents: number; amount_due_now_cents: number; service_name_snapshot: string }
    | null;
  if (!b) return { paid: false as const };

  // Persist the chargeable card on the booking REGARDLESS of current status. The
  // webhook may have already flipped the booking to confirmed; we must not lose
  // the customer/PM the balance hold + tips depend on (do NOT gate on pending).
  const cardPatch: Record<string, unknown> = {};
  if (customerId) cardPatch.stripe_customer_id = customerId;
  if (paymentMethodId) cardPatch.stripe_payment_method_id = paymentMethodId;

  // Idempotent confirmation (webhook may also run this).
  if (b.status === "pending_payment") {
    const balanceCents = Math.max(0, (b.total_cents ?? 0) - (b.amount_due_now_cents ?? 0));
    await admin
      .from("bookings")
      .update({ status: "confirmed", confirmed_at: new Date().toISOString(), stripe_payment_intent_id: piId, balance_cents: balanceCents, ...cardPatch })
      .eq("id", b.id)
      .eq("status", "pending_payment");
    await admin.from("payments").upsert(
      { booking_id: b.id, status: "succeeded", amount_cents: session.amount_total ?? b.amount_due_now_cents, stripe_payment_intent_id: piId },
      { onConflict: "stripe_payment_intent_id" },
    );
    await admin.from("booking_status_events").insert({ booking_id: b.id, status: "confirmed", note: "Payment succeeded (Checkout)" });
  } else if (Object.keys(cardPatch).length > 0) {
    await admin.from("bookings").update(cardPatch).eq("id", b.id);
  }

  // Ensure the conversation exists + both members + unlock, then hand the id to
  // the UI so we can deep-link the customer straight into messaging.
  const conversationId = await ensureBookingConversationUnlocked(admin, b.id, b.customer_id, b.professional_id);
  return { paid: true as const, service: b.service_name_snapshot, total: b.total_cents, conversationId };
}

export default async function BookingSuccessPage({ searchParams }: { searchParams: Promise<{ session_id?: string }> }) {
  const { session_id } = await searchParams;

  let result: { paid: boolean; service?: string; total?: number; conversationId?: string | null } = { paid: false };
  if (isLiveSupabase() && isStripeConfigured() && session_id) {
    result = await confirmFromSession(session_id);
  }

  return (
    <Shell back="/bookings">
      <div className="mx-auto max-w-md py-10 text-center">
        {result.paid ? (
          <>
            <div className="mx-auto grid h-16 w-16 place-items-center rounded-full rose-gradient text-3xl text-[#2A1712]">✓</div>
            <h1 className="mt-4 font-display text-2xl font-bold">Booking confirmed</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              Your payment went through and your stylist has been notified. Messaging is now unlocked for this booking.
            </p>
            {result.service && (
              <div className="card-luxe mt-6 p-4 text-left text-sm">
                <div className="flex justify-between">
                  <span className="text-ink-muted">Service</span>
                  <span className="font-semibold">{result.service}</span>
                </div>
                {result.total != null && (
                  <div className="mt-1 flex justify-between">
                    <span className="text-ink-muted">Total</span>
                    <span className="font-semibold">{formatPrice(result.total)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="mt-6 flex flex-col items-center gap-3">
              <Link
                href={result.conversationId ? `/messages/${result.conversationId}` : "/messages"}
                className="inline-block rounded-full rose-gradient px-6 py-2.5 text-sm font-semibold text-[#2A1712]"
              >
                Message your stylist
              </Link>
              <Link href="/account" className="text-sm font-semibold text-rose hover:underline">
                View my bookings →
              </Link>
            </div>
          </>
        ) : (
          <>
            <h1 className="font-display text-2xl font-bold">Payment not completed</h1>
            <p className="mt-2 text-sm text-ink-secondary">
              We couldn&apos;t confirm a completed payment for this booking. If you were charged, it will reconcile
              shortly — check your bookings.
            </p>
            <Link href="/account" className="mt-6 inline-block text-sm font-semibold text-rose hover:underline">
              Go to my bookings →
            </Link>
          </>
        )}
      </div>
    </Shell>
  );
}
