"use server";
// Admin trust & safety actions. Every action: (1) verifies the caller is an admin
// server-side, (2) writes via the service-role client, (3) records an audit log.
// Fraud/safety actions FREEZE — they never delete user data (business rule).
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { writeAudit } from "@/lib/audit/log";
import { getStripe } from "@/lib/payments/stripe";
import { reverseBookingPayout } from "@/lib/payments/payouts";

type Admin = ReturnType<typeof createAdminClient>;

export type AdminActionResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: false; error: string } | { ok: true; userId: string }> {
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to use admin tools." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") return { ok: false, error: "Admin only." };
  return { ok: true, userId: auth.user.id };
}

export type VerificationDecision = "approve" | "reject" | "request_info" | "suspend" | "revoke";

export async function decideVerificationAction(
  professionalId: string,
  decision: VerificationDecision,
  note?: string,
): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();

  const statusMap: Record<VerificationDecision, string> = {
    approve: "approved",
    reject: "rejected",
    request_info: "more_info_requested",
    suspend: "suspended",
    revoke: "revoked",
  };
  const status = statusMap[decision];

  const { error } = await admin
    .from("professional_verifications")
    .update({ status, reviewed_by: gate.userId, reviewed_at: new Date().toISOString(), requested_info: decision === "request_info" ? note ?? null : null })
    .eq("professional_id", professionalId);
  if (error) return { ok: false, error: error.message };

  // Identity-verified flag on the public profile follows approval/revocation.
  await admin.from("professional_profiles").update({ is_verified: decision === "approve" }).eq("user_id", professionalId);

  await writeAudit({ actorId: gate.userId, action: `verification.${decision}`, entity: "professional", entityId: professionalId, metadata: { note } });
  revalidatePath("/admin");
  return { ok: true };
}

export type DisputeAction = "refund" | "partial_refund" | "reject" | "escalate" | "freeze_payout" | "request_evidence";

export async function resolveDisputeAction(
  disputeId: string,
  action: DisputeAction,
  opts?: { amountCents?: number; note?: string },
): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();

  const statusMap: Record<DisputeAction, string> = {
    refund: "resolved_refund",
    partial_refund: "resolved_refund",
    reject: "resolved_declined",
    escalate: "under_investigation",
    freeze_payout: "under_investigation",
    request_evidence: "awaiting_response",
  };

  const { data: dispute } = await admin.from("disputes").select("booking_id").eq("id", disputeId).maybeSingle();
  const bookingId = (dispute as { booking_id?: string } | null)?.booking_id;

  // Money moves BEFORE the dispute is marked resolved: refund the customer, claw
  // back the pro's payout, and update the booking/payment status. If the refund
  // can't be issued we bail out — the dispute stays open rather than being marked
  // "resolved_refund" with no money actually returned.
  if ((action === "refund" || action === "partial_refund") && bookingId) {
    const settle = await settleDisputeRefund(admin, bookingId, action === "partial_refund" ? opts?.amountCents : undefined);
    if (!settle.ok) return { ok: false, error: settle.error };
  }

  const { error } = await admin
    .from("disputes")
    .update({ status: statusMap[action], resolution: opts?.note ?? null, resolved_by: gate.userId, updated_at: new Date().toISOString() })
    .eq("id", disputeId);
  if (error) return { ok: false, error: error.message };

  if (action === "freeze_payout" && bookingId) {
    const { data: b } = await admin.from("bookings").select("professional_id").eq("id", bookingId).maybeSingle();
    const proId = (b as { professional_id?: string } | null)?.professional_id;
    if (proId) await admin.from("professional_profiles").update({ payouts_frozen: true }).eq("user_id", proId);
  }

  await admin.from("dispute_events").insert({ dispute_id: disputeId, actor_id: gate.userId, action, note: opts?.note ?? null });
  await writeAudit({ actorId: gate.userId, action: `dispute.${action}`, entity: "dispute", entityId: disputeId, metadata: { ...opts } });
  revalidatePath("/admin");
  return { ok: true };
}

export type ReportAction = "reviewing" | "actioned" | "dismissed";

export async function resolveReportAction(reportId: string, action: ReportAction, note?: string): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin
    .from("content_reports")
    .update({ status: action, resolution: note ?? null, resolved_by: gate.userId, updated_at: new Date().toISOString() })
    .eq("id", reportId);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ actorId: gate.userId, action: `report.${action}`, entity: "report", entityId: reportId, metadata: { note } });
  revalidatePath("/admin");
  return { ok: true };
}

/** Freeze / unfreeze an account or its payouts. Never deletes data. */
export async function setAccountFreezeAction(
  userId: string,
  target: "account" | "payouts",
  frozen: boolean,
): Promise<AdminActionResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const column = target === "payouts" ? "payouts_frozen" : "is_frozen";
  const { error } = await admin.from("professional_profiles").update({ [column]: frozen }).eq("user_id", userId);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ actorId: gate.userId, action: `account.${target}.${frozen ? "freeze" : "unfreeze"}`, entity: "user", entityId: userId });
  revalidatePath("/admin");
  return { ok: true };
}

/**
 * Refund a disputed booking's collected charges via Stripe, reverse the pro's
 * payout proportionally, and reflect the settlement on the booking + payments.
 * Full refund → every succeeded charge in full; partial → the given amount off the
 * largest (deposit) charge. Idempotent via per-refund Stripe idempotency keys; the
 * charge.refunded webhook reconciles the same fields idempotently. Returns an error
 * (leaving the dispute unresolved) if Stripe can't issue the refund.
 */
async function settleDisputeRefund(
  admin: Admin,
  bookingId: string,
  partialAmountCents?: number,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const { data: payments } = await admin
    .from("payments")
    .select("stripe_payment_intent_id, amount_cents, status")
    .eq("booking_id", bookingId);
  const charged = ((payments ?? []) as { stripe_payment_intent_id: string | null; amount_cents: number; status: string }[])
    .filter((r) => r.stripe_payment_intent_id && (r.status === "succeeded" || r.status === "partially_refunded"));
  if (charged.length === 0) return { ok: true }; // nothing collected to refund.

  const isPartial = partialAmountCents != null;
  if (isPartial && (!Number.isInteger(partialAmountCents) || partialAmountCents <= 0)) {
    return { ok: false, error: "Enter a valid partial refund amount." };
  }

  let refundedCents = 0;
  try {
    const stripe = await getStripe();
    if (isPartial) {
      // Refund the partial amount off the largest charge (the deposit).
      const target = charged.reduce((a, c) => (c.amount_cents > a.amount_cents ? c : a));
      const amount = Math.min(partialAmountCents as number, target.amount_cents);
      await stripe.refunds.create(
        { payment_intent: target.stripe_payment_intent_id as string, amount, metadata: { bookingId, kind: "dispute_partial" } },
        { idempotencyKey: `refund_dispute_${bookingId}_partial` },
      );
      refundedCents = amount;
    } else {
      for (const c of charged) {
        await stripe.refunds.create(
          { payment_intent: c.stripe_payment_intent_id as string, metadata: { bookingId, kind: "dispute_full" } },
          { idempotencyKey: `refund_dispute_${bookingId}_${c.stripe_payment_intent_id}` },
        );
        refundedCents += c.amount_cents;
      }
    }
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Refund failed.";
    return { ok: false, error: `Couldn't issue the refund: ${msg}` };
  }

  // Claw back the pro's payout in proportion to the refund.
  await reverseBookingPayout(admin, { bookingId, refundedCents });

  // Reflect the settlement. A full refund settles the booking to 'refunded'; a
  // partial leaves the booking status and just marks the payment partially refunded.
  if (!isPartial) {
    await admin.from("bookings").update({ status: "refunded" }).eq("id", bookingId);
  }
  await admin
    .from("payments")
    .update({ status: isPartial ? "partially_refunded" : "refunded" })
    .eq("booking_id", bookingId)
    .neq("status", "refunded");
  return { ok: true };
}
