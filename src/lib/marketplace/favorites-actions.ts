"use server";
// Favorite + recently-viewed mutations. Ownership enforced by RLS; we also
// validate here (auth required, target must be an active professional).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

const idSchema = z.string().uuid();

export type FavoriteResult =
  | { ok: true; favorited: boolean }
  | { ok: false; needsAuth?: true; error: string };

export async function toggleFavoriteAction(professionalId: string): Promise<FavoriteResult> {
  const parsed = idSchema.safeParse(professionalId);
  if (!parsed.success) return { ok: false, error: "Invalid professional." };
  if (!isLiveSupabase()) return { ok: false, error: "Favorites need a connected database." };

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, needsAuth: true, error: "Please sign in to save favorites." };

  // Guard: cannot favorite an inactive/suspended professional.
  const { data: pro } = await supabase
    .from("professional_profiles")
    .select("user_id, is_active")
    .eq("user_id", parsed.data)
    .maybeSingle();
  if (!pro || !(pro as { is_active: boolean }).is_active) {
    return { ok: false, error: "This professional is not available." };
  }

  const { data: existing } = await supabase
    .from("favorites")
    .select("professional_id")
    .eq("customer_id", auth.user.id)
    .eq("professional_id", parsed.data)
    .maybeSingle();

  if (existing) {
    await supabase.from("favorites").delete().eq("customer_id", auth.user.id).eq("professional_id", parsed.data);
    revalidatePath("/account/favorites");
    return { ok: true, favorited: false };
  }
  await supabase.from("favorites").insert({ customer_id: auth.user.id, professional_id: parsed.data });
  revalidatePath("/account/favorites");
  return { ok: true, favorited: true };
}

export async function recordProfessionalViewAction(professionalId: string): Promise<void> {
  const parsed = idSchema.safeParse(professionalId);
  if (!parsed.success || !isLiveSupabase()) return;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return; // guests persist locally on the client instead
  await supabase
    .from("recently_viewed")
    .upsert(
      { customer_id: auth.user.id, professional_id: parsed.data, viewed_at: new Date().toISOString() },
      { onConflict: "customer_id,professional_id" },
    );
}
