import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import type { Campaign } from "./campaigns";

function mapRow(r: Record<string, unknown>): Campaign {
  return {
    id: String(r.id), name: String(r.name), type: r.type as Campaign["type"],
    discountType: r.discount_type as Campaign["discountType"], discountValue: Number(r.discount_value),
    isActive: Boolean(r.is_active), startsAt: (r.starts_at as string) ?? undefined, endsAt: (r.ends_at as string) ?? undefined,
    cities: (r.cities as string[]) ?? [], minSubtotalCents: (r.min_subtotal_cents as number) ?? undefined,
    abTreatmentFraction: (r.ab_treatment_fraction as number) ?? undefined,
  };
}

export async function listCampaigns(): Promise<Campaign[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.from("campaigns").select("*").order("created_at", { ascending: false }).limit(200);
  return ((data as unknown as Array<Record<string, unknown>>) ?? []).map(mapRow);
}
