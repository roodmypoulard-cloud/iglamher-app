"use server";
// Loyalty mutations. Earning happens server-side on booking completion; redemption
// converts points to account credit. All point writes go through the service-role
// client (loyalty tables have no client write policy — read-only via RLS).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { pointsForRedemption } from "./engine";
import { rateLimitGuard } from "@/lib/security/guard";

export type LoyaltyResult = { ok: true; message: string } | { ok: false; error: string };

const redeemSchema = z.object({ discountCents: z.coerce.number().int().min(500).max(50000) });

export async function redeemPointsAction(raw: unknown): Promise<LoyaltyResult> {
  const limited = await rateLimitGuard("loyalty");
  if (limited) return { ok: false, error: limited };
  const parsed = redeemSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Enter a valid amount ($5 minimum)." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect the backend to redeem." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  const admin = createAdminClient();
  const cost = pointsForRedemption(parsed.data.discountCents);

  // Atomic conditional debit — the RPC only succeeds if the balance covers the
  // cost, so concurrent redemptions can't double-spend (see 0011_phase10_fixes).
  const { data: ok, error } = await admin.rpc("redeem_loyalty_points", {
    p_user: auth.user.id,
    p_cost: cost,
    p_credit_cents: parsed.data.discountCents,
  });
  if (error) return { ok: false, error: "Could not redeem right now. Try again." };
  if (ok !== true) return { ok: false, error: "Not enough points." };

  revalidatePath("/account/rewards");
  return { ok: true, message: `Redeemed ${cost} points for $${(parsed.data.discountCents / 100).toFixed(2)} credit.` };
}
