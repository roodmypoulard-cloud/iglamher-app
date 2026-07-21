"use server";
// Marketing campaign admin actions. Admin-gated + audit-logged (every admin
// action generates an audit record — Phase 6 rule).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { writeAudit } from "@/lib/audit/log";

export type CampaignResult = { ok: true } | { ok: false; error: string };

async function requireAdmin(): Promise<{ ok: false; error: string } | { ok: true; userId: string }> {
  if (!isLiveSupabase()) return { ok: false, error: "Connect the backend." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Sign in required." };
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  if ((data as { role?: string } | null)?.role !== "admin") return { ok: false, error: "Admin only." };
  return { ok: true, userId: auth.user.id };
}

const schema = z.object({
  name: z.string().trim().min(2).max(80),
  type: z.enum(["coupon", "seasonal", "geo", "abandoned_booking", "influencer"]),
  discountType: z.enum(["percent", "fixed"]),
  discountValue: z.coerce.number().int().min(1).max(100000),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  cities: z.string().optional(), // comma-separated
});

export async function createCampaignAction(raw: unknown): Promise<CampaignResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: parsed.error.issues[0]?.message ?? "Invalid campaign." };
  const v = parsed.data;

  const admin = createAdminClient();
  const { data, error } = await admin.from("campaigns").insert({
    name: v.name, type: v.type, discount_type: v.discountType, discount_value: v.discountValue,
    starts_at: v.startsAt || null, ends_at: v.endsAt || null,
    cities: v.cities ? v.cities.split(",").map((c) => c.trim()).filter(Boolean) : [],
    created_by: gate.userId, is_active: true,
  }).select("id").maybeSingle();
  if (error) return { ok: false, error: error.message };

  await writeAudit({ actorId: gate.userId, action: "campaign.create", entity: "campaign", entityId: (data as { id?: string } | null)?.id, metadata: { name: v.name } });
  revalidatePath("/admin/campaigns");
  return { ok: true };
}

export async function toggleCampaignAction(campaignId: string, active: boolean): Promise<CampaignResult> {
  const gate = await requireAdmin();
  if (!gate.ok) return gate;
  const admin = createAdminClient();
  const { error } = await admin.from("campaigns").update({ is_active: active }).eq("id", campaignId);
  if (error) return { ok: false, error: error.message };
  await writeAudit({ actorId: gate.userId, action: `campaign.${active ? "activate" : "deactivate"}`, entity: "campaign", entityId: campaignId });
  revalidatePath("/admin/campaigns");
  return { ok: true };
}
