import "server-only";
// Internal loyalty award helper. INTENTIONALLY not in a "use server" module —
// it must NOT be a client-callable action (it grants points). It is called only
// from trusted server code (booking completion) after ownership is verified.
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { tierForLifetime, pointsForBooking } from "./engine";

/** Award points for a completed booking. Idempotent per booking. Server-internal. */
export async function awardBookingPoints(userId: string, bookingId: string, subtotalCents: number): Promise<void> {
  if (!isLiveSupabase()) return;
  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("loyalty_transactions")
    .select("id")
    .eq("booking_id", bookingId)
    .eq("reason", "earn_booking")
    .maybeSingle();
  if (existing) return; // already awarded

  const { data: acct } = await admin.from("loyalty_accounts").select("points,lifetime_points").eq("user_id", userId).maybeSingle();
  const lifetime = (acct as { lifetime_points?: number } | null)?.lifetime_points ?? 0;
  const pts = pointsForBooking(subtotalCents, lifetime);
  const points = ((acct as { points?: number } | null)?.points ?? 0) + pts;
  const lifetimePoints = lifetime + pts;

  await admin.from("loyalty_accounts").upsert(
    { user_id: userId, points, lifetime_points: lifetimePoints, tier: tierForLifetime(lifetimePoints).tier, updated_at: new Date().toISOString() },
    { onConflict: "user_id" },
  );
  await admin.from("loyalty_transactions").insert({ user_id: userId, points_delta: pts, reason: "earn_booking", booking_id: bookingId });
}
