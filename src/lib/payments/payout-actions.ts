"use server";
// Failed-payout recovery — re-attempt a transfer that failed, or that was left
// pending because the professional hadn't finished Connect onboarding at charge
// time. Callable by the professional who owns the booking, or an admin.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { transferBookingPayout, payoutAmountCents } from "./payouts";

export type RetryPayoutResult = { ok: true; status: string } | { ok: false; error: string };

const PAYABLE_STATUSES = new Set(["confirmed", "in_progress", "completed"]);

export async function retryBookingPayoutAction(bookingId: string): Promise<RetryPayoutResult> {
  if (!isLiveSupabase()) return { ok: false, error: "Connect the backend to run payouts." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const { data: bk } = await admin
    .from("bookings")
    .select("professional_id, total_cents, platform_fee_cents, status")
    .eq("id", bookingId)
    .maybeSingle();
  const row = bk as
    | { professional_id?: string; total_cents?: number; platform_fee_cents?: number; status?: string }
    | null;
  if (!row?.professional_id) return { ok: false, error: "Booking not found." };

  // Authorize: the owning professional, or an admin.
  const { data: prof } = await admin.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const isAdmin = (prof as { role?: string } | null)?.role === "admin";
  if (auth.user.id !== row.professional_id && !isAdmin) return { ok: false, error: "Not authorized." };

  if (!row.status || !PAYABLE_STATUSES.has(row.status)) {
    return { ok: false, error: "This booking isn't in a payable state." };
  }

  const netCents = payoutAmountCents(row.total_cents ?? 0, row.platform_fee_cents ?? 0);
  const outcome = await transferBookingPayout(admin, {
    bookingId,
    professionalId: row.professional_id,
    netCents,
  });
  if (outcome.status === "failed") return { ok: false, error: outcome.reason };
  if (outcome.status === "skipped" && outcome.reason === "connect_not_ready") {
    return { ok: false, error: "Finish Stripe payout onboarding first." };
  }
  return { ok: true, status: outcome.status };
}
