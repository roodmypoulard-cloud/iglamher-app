"use server";
// Booking mutations. Price is ALWAYS recomputed server-side from stored service
// data — never trusted from the client. Creation is atomic via create_booking()
// which relies on the exclusion constraint to reject double-bookings.
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { transferBookingPayout } from "@/lib/payments/payouts";
import { holdBookingBalance, captureBookingBalance, releaseBookingBalance } from "@/lib/payments/balance";
import { isLiveSupabase } from "@/lib/data/source";
import { getServiceWithProfessional } from "@/lib/data/professionals";
import { computeBooking, cancellationFee, type PriceBreakdown } from "./pricing";
import { canTransition, type BookingStatus, type Actor } from "./status";
import { getStripe, isStripeConfigured } from "@/lib/payments/stripe";
import { awardBookingPoints } from "@/lib/loyalty/award";
import { isBookingsPaused } from "@/lib/ops/settings";
import { emailUserBestEffort } from "@/lib/integrations/notifications";
import { rateLimitGuard } from "@/lib/security/guard";

const draftSchema = z.object({
  professionalId: z.string().uuid(),
  serviceId: z.string().uuid(),
  startUtc: z.string().datetime(),
  endUtc: z.string().datetime(),
  addonIds: z.array(z.string().uuid()).max(20).optional().default([]),
  tipCents: z.coerce.number().int().min(0).max(1_000_00).optional().default(0),
  notes: z.string().max(600).optional(),
});

export type DraftResult =
  | { ok: true; bookingId: string; breakdown: PriceBreakdown; demo: boolean }
  | { ok: false; error: string };

export async function createBookingDraftAction(raw: unknown): Promise<DraftResult> {
  const limited = await rateLimitGuard("booking");
  if (limited) return { ok: false, error: limited };
  // Operational kill-switch: admin can pause new bookings without downtime.
  if (await isBookingsPaused()) {
    return { ok: false, error: "New bookings are temporarily paused. Please try again shortly." };
  }
  const parsed = draftSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid booking details." };
  const input = parsed.data;

  // Load the service + pro to price authoritatively (seed or live).
  const found = await getServiceWithProfessional(input.serviceId);
  if (!found || found.professional.userId !== input.professionalId) {
    return { ok: false, error: "Service not found." };
  }
  const { service, professional } = found;

  const addons = professional.addons.filter((a) => input.addonIds.includes(a.id) && a.isActive);
  const addonsCents = addons.reduce((sum, a) => sum + a.priceCents, 0);
  const travelFeeCents = service.locationType === "mobile" ? service.travelFeeCents ?? 0 : 0;

  const breakdown = computeBooking({
    serviceCents: service.priceCents,
    addonsCents,
    travelFeeCents,
    tipCents: input.tipCents,
    takeRateBps: 1500, // professional.take_rate; default 15%
    deposit: { type: service.depositType, value: service.depositValue ?? undefined },
  });

  if (!isLiveSupabase()) {
    // Demo mode: no DB, so return a synthetic confirmed draft for the UI flow.
    return { ok: true, bookingId: `demo-${crypto.randomUUID()}`, breakdown, demo: true };
  }

  // Payments must be live before we reserve a slot. A pending_payment booking holds
  // the time slot; if Stripe isn't configured, checkout can never complete and the
  // slot would orphan. Fail fast rather than create an unpayable draft.
  if (!isStripeConfigured()) {
    return { ok: false, error: "Payments aren't available right now. Please try again shortly." };
  }

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in to book." };

  // Account-status protection: a paused/deactivated customer cannot book, and no
  // one can book a paused/deactivated/deleted professional. Server-enforced so it
  // can't be bypassed via direct calls (the pro is also hidden from listings).
  const { data: parties } = await supabase
    .from("profiles")
    .select("id, account_status")
    .in("id", [auth.user.id, input.professionalId]);
  const rows = (parties ?? []) as { id: string; account_status?: string }[];
  const me = rows.find((r) => r.id === auth.user!.id);
  const pro = rows.find((r) => r.id === input.professionalId);
  if (me?.account_status && me.account_status !== "active") {
    return { ok: false, error: "Your account is paused. Reactivate it to make a booking." };
  }
  if (pro?.account_status && pro.account_status !== "active") {
    return { ok: false, error: "This professional is not currently accepting bookings." };
  }

  // Professional moderation status lives on professional_profiles.account_status (0024)
  // — a suspended/banned pro can't take new bookings. Best-effort: pre-0024 there's no
  // column, so a missing column yields null data and simply doesn't block.
  const { data: proProfile } = await supabase
    .from("professional_profiles")
    .select("account_status")
    .eq("user_id", input.professionalId)
    .maybeSingle();
  const proModeration = (proProfile as { account_status?: string } | null)?.account_status;
  if (proModeration && proModeration !== "active") {
    return { ok: false, error: "This professional is not currently accepting bookings." };
  }

  const lineItems = breakdown.lineItems.map((l) => ({ kind: l.kind, label: l.label, amountCents: l.amountCents }));
  const { data, error } = await supabase.rpc("create_booking", {
    p_customer: auth.user.id,
    p_professional: input.professionalId,
    p_service: input.serviceId,
    p_starts_at: input.startUtc,
    p_ends_at: input.endUtc,
    p_timezone: professional.timezone,
    p_location_type: service.locationType,
    p_service_name: service.name,
    p_subtotal: breakdown.subtotalCents,
    p_addons: breakdown.addonsCents,
    p_travel: breakdown.travelFeeCents,
    p_tax: breakdown.taxCents,
    p_discount: breakdown.discountCents,
    p_tip: breakdown.tipCents,
    p_fees: 0,
    p_total: breakdown.totalCents,
    p_due_now: breakdown.amountDueNowCents,
    p_platform_fee: breakdown.platformFeeCents,
    p_line_items: lineItems,
    p_notes: input.notes ?? null,
  });
  if (error) {
    if (error.message.includes("SLOT_TAKEN")) {
      return { ok: false, error: "That time was just booked — please choose another slot." };
    }
    return { ok: false, error: error.message };
  }
  return { ok: true, bookingId: data as string, breakdown, demo: false };
}

/**
 * Release an unpaid draft booking (still `pending_payment`) — called when Stripe
 * Checkout couldn't be started, so the reserved slot frees up immediately instead
 * of waiting on Stripe's `payment_intent.canceled` webhook. Scoped to the booking's
 * own customer and no-ops if the booking has already moved past `pending_payment`.
 */
export async function cancelUnpaidBookingAction(bookingId: string): Promise<{ ok: boolean }> {
  if (!isLiveSupabase()) return { ok: true };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false };

  const admin = createAdminClient();
  const { error } = await admin
    .from("bookings")
    .update({ status: "cancelled_customer", cancelled_at: new Date().toISOString(), cancellation_reason: "Payment not completed" })
    .eq("id", bookingId)
    .eq("customer_id", auth.user.id)
    .eq("status", "pending_payment");
  if (error) return { ok: false };
  await admin
    .from("booking_status_events")
    .insert({ booking_id: bookingId, status: "cancelled_customer", actor_id: auth.user.id, note: "Checkout not started" })
    .then(() => {}, () => {});
  return { ok: true };
}

// ---- status transitions (professional / customer actions) ----
const STATUS_ACTIONS: Record<string, { to: BookingStatus; actor: Actor }> = {
  accept: { to: "confirmed", actor: "professional" },
  start: { to: "in_progress", actor: "professional" },
  complete: { to: "completed", actor: "professional" },
  reject: { to: "cancelled_professional", actor: "professional" },
  cancel: { to: "cancelled_customer", actor: "customer" },
  "no-show": { to: "no_show", actor: "professional" },
};

export type StatusResult = { ok: true; status: BookingStatus } | { ok: false; error: string };

export async function updateBookingStatusAction(
  bookingId: string,
  action: keyof typeof STATUS_ACTIONS,
  reason?: string,
): Promise<StatusResult> {
  const move = STATUS_ACTIONS[action];
  if (!move) return { ok: false, error: "Unknown action." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to manage bookings." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  const { data: booking } = await supabase.from("bookings").select("status, customer_id, professional_id, subtotal_cents, total_cents, amount_due_now_cents, platform_fee_cents, starts_at, stripe_payment_intent_id").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };
  const b = booking as { status: BookingStatus; customer_id: string; professional_id: string; subtotal_cents: number; total_cents: number; amount_due_now_cents: number; platform_fee_cents: number; starts_at: string; stripe_payment_intent_id: string | null };

  const isParty =
    (move.actor === "customer" && b.customer_id === auth.user.id) ||
    (move.actor === "professional" && b.professional_id === auth.user.id);
  if (!isParty) return { ok: false, error: "Not authorized for this booking." };

  if (!canTransition(b.status, move.to, move.actor)) {
    return { ok: false, error: `Cannot ${action} a ${b.status} booking.` };
  }

  const admin = createAdminClient();

  // 0005 column guards forbid a user session from writing the platform-only
  // statuses (start/complete flip to in_progress/completed). Those transitions
  // must go through the service-role client; cancel/no-show stay on the user
  // client where the guard already permits them.
  const GUARDED_STATUSES: BookingStatus[] = ["confirmed", "in_progress", "completed", "refunded", "disputed"];
  const writer = GUARDED_STATUSES.includes(move.to) ? admin : supabase;

  // Day-of balance HOLD when the pro starts the job — authorize the remaining
  // balance on the saved card to confirm funds. Blocks the start if it can't.
  if (action === "start") {
    const hold = await holdBookingBalance(admin, bookingId);
    if (!hold.ok) return { ok: false, error: hold.error };
  }

  // Completion collects money BEFORE the booking is flipped to completed: capture
  // the held balance first. If the card can't be charged we abort WITHOUT marking
  // complete, paying out, or awarding points — so a failed capture never leaves a
  // "completed" booking the platform never collected for. captureBookingBalance is
  // idempotent (an already-captured balance short-circuits), so a retry after a
  // mid-flow crash — held OR captured but not yet completed — re-captures cleanly.
  let capturedCents = 0;
  if (move.to === "completed") {
    const cap = await captureBookingBalance(admin, bookingId);
    if (cap.error) {
      return { ok: false, error: "Couldn't charge the remaining balance, so the appointment wasn't marked complete. Please try again." };
    }
    capturedCents = cap.captured ?? 0;
  }

  // Cancellation refund: return the deposit per policy BEFORE flipping status. A
  // pro-initiated cancellation always fully refunds the customer; a customer one
  // applies the hours-to-start fee tiers. A refund failure aborts the cancel so it
  // can be retried (idempotent) rather than cancelling with the money still held.
  if (move.to.startsWith("cancelled")) {
    const refund = await refundDepositOnCancel(b, move.actor);
    if (!refund.ok) return { ok: false, error: refund.error };
  }

  const patch: Record<string, unknown> = { status: move.to };
  if (move.to.startsWith("cancelled")) {
    patch.cancelled_at = new Date().toISOString();
    patch.cancellation_reason = reason ?? null;
  }
  if (move.to === "completed") patch.completed_at = new Date().toISOString();

  const { error } = await writer.from("bookings").update(patch).eq("id", bookingId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("booking_status_events").insert({ booking_id: bookingId, status: move.to, actor_id: auth.user.id, note: reason ?? null });

  // Lifecycle notifications (best-effort, via service role).
  try {
    const notify = async (userId: string, title: string, body: string) => {
      await admin.from("notifications").insert({ user_id: userId, type: "booking", title, body, data: { bookingId } });
      await emailUserBestEffort(userId, "booking", title, body);
    };
    if (move.to === "in_progress") await notify(b.customer_id, "Appointment started", "Your provider has started your service.");
    else if (move.to === "completed") {
      await notify(b.customer_id, "Appointment completed", "Your service is complete — add a tip and leave a review.");
      await notify(b.professional_id, "Appointment completed", "Nice work! You can now review your client.");
    } else if (move.to.startsWith("cancelled") || move.to === "no_show") {
      await notify(move.actor === "customer" ? b.professional_id : b.customer_id, "Booking cancelled", "A booking was cancelled.");
    }
  } catch { /* notifications are best-effort */ }

  if (move.to === "completed") {
    // iGlam Rewards (idempotent).
    await awardBookingPoints(b.customer_id, bookingId, b.subtotal_cents);
    // The balance was already CAPTURED above (before the status flip). Pay the
    // provider from funds actually collected (deposit + captured balance) minus the
    // platform fee, so the payout can never exceed what the platform holds.
    const collected = (b.amount_due_now_cents ?? 0) + capturedCents;
    const netCents = Math.max(0, collected - (b.platform_fee_cents ?? 0));
    if (netCents > 0) {
      await transferBookingPayout(admin, { bookingId, professionalId: b.professional_id, netCents });
    }
  } else if (move.to.startsWith("cancelled") || move.to === "no_show") {
    // Release the balance hold (never captured).
    await releaseBookingBalance(admin, bookingId);
  }
  return { ok: true, status: move.to };
}

/**
 * Refund the customer's deposit on cancellation, honoring the cancellation policy.
 * The deposit was charged on the booking's primary PaymentIntent. Idempotent via a
 * per-PI Stripe idempotency key, so a retried cancellation never double-refunds.
 */
async function refundDepositOnCancel(
  b: { starts_at: string; amount_due_now_cents: number; stripe_payment_intent_id: string | null },
  actor: Actor,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const depositPi = b.stripe_payment_intent_id;
  const depositCents = b.amount_due_now_cents ?? 0;
  // Nothing collected yet (e.g. still pending_payment) — cancellation just proceeds.
  if (!depositPi || depositCents <= 0) return { ok: true };

  const hoursUntilStart = (new Date(b.starts_at).getTime() - Date.now()) / 3_600_000;
  // A professional cancelling never penalizes the customer — full deposit back.
  const refundCents =
    actor === "professional" ? depositCents : cancellationFee(depositCents, hoursUntilStart).refundCents;
  if (refundCents <= 0) return { ok: true }; // policy fee consumes the whole deposit.

  try {
    const stripe = await getStripe();
    await stripe.refunds.create(
      { payment_intent: depositPi, amount: refundCents, metadata: { kind: "cancellation" } },
      { idempotencyKey: `refund_cancel_${depositPi}` },
    );
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refund failed.";
    return { ok: false, error: `Couldn't refund the deposit, so the booking wasn't cancelled: ${msg}` };
  }
}
