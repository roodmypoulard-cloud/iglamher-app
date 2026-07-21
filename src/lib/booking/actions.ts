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
import { computeBooking, type PriceBreakdown } from "./pricing";
import { canTransition, type BookingStatus, type Actor } from "./status";
import { awardBookingPoints } from "@/lib/loyalty/award";
import { isBookingsPaused } from "@/lib/ops/settings";

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

  const { data: booking } = await supabase.from("bookings").select("status, customer_id, professional_id, subtotal_cents, total_cents, amount_due_now_cents, platform_fee_cents").eq("id", bookingId).maybeSingle();
  if (!booking) return { ok: false, error: "Booking not found." };
  const b = booking as { status: BookingStatus; customer_id: string; professional_id: string; subtotal_cents: number; total_cents: number; amount_due_now_cents: number; platform_fee_cents: number };

  const isParty =
    (move.actor === "customer" && b.customer_id === auth.user.id) ||
    (move.actor === "professional" && b.professional_id === auth.user.id);
  if (!isParty) return { ok: false, error: "Not authorized for this booking." };

  if (!canTransition(b.status, move.to, move.actor)) {
    return { ok: false, error: `Cannot ${action} a ${b.status} booking.` };
  }

  const admin = createAdminClient();

  // Day-of balance HOLD when the pro starts the job — authorize the remaining
  // balance on the saved card to confirm funds. Blocks the start if it can't.
  if (action === "start") {
    const hold = await holdBookingBalance(admin, bookingId);
    if (!hold.ok) return { ok: false, error: hold.error };
  }

  const patch: Record<string, unknown> = { status: move.to };
  if (move.to.startsWith("cancelled")) {
    patch.cancelled_at = new Date().toISOString();
    patch.cancellation_reason = reason ?? null;
  }
  if (move.to === "completed") patch.completed_at = new Date().toISOString();

  const { error } = await supabase.from("bookings").update(patch).eq("id", bookingId);
  if (error) return { ok: false, error: error.message };
  await supabase.from("booking_status_events").insert({ booking_id: bookingId, status: move.to, actor_id: auth.user.id, note: reason ?? null });

  // Lifecycle notifications (best-effort, via service role).
  try {
    const notify = (userId: string, title: string, body: string) =>
      admin.from("notifications").insert({ user_id: userId, type: "booking", title, body, data: { bookingId } });
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
    // CAPTURE the held balance (debit the card), then pay the provider. Payout is
    // computed from funds actually collected (deposit + captured balance) minus the
    // platform fee, so it can never exceed what the platform holds.
    const cap = await captureBookingBalance(admin, bookingId);
    const collected = (b.amount_due_now_cents ?? 0) + (cap.captured ?? 0);
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
