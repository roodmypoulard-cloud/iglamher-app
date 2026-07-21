"use server";
// Professional mutations. Every action authenticates, validates the current user
// is a professional operating on their OWN rows, and validates input with Zod.
// RLS is the backstop: services/availability policies check auth.uid() = professional_id.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { serviceSchema, availabilitySchema, profileSchema, UPLOAD_LIMITS, safeFilename } from "./schemas";

export type ActionState = { error?: string; success?: string; fieldErrors?: Record<string, string> } | undefined;

async function requirePro(): Promise<{ error: string } | { userId: string }> {
  if (!isLiveSupabase()) {
    return { error: "This is a preview. Connect Supabase to save changes." };
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const { data: profile } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  const role = (profile as { role: string } | null)?.role;
  if (role !== "professional" && role !== "admin") return { error: "Professional account required." };
  return { userId: auth.user.id };
}

function fieldErrorsFrom(e: import("zod").ZodError): Record<string, string> {
  const out: Record<string, string> = {};
  for (const issue of e.issues) {
    const key = String(issue.path[0] ?? "form");
    if (!out[key]) out[key] = issue.message;
  }
  return out;
}

export async function saveServiceAction(
  serviceId: string | null,
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };

  const parsed = serviceSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();
  const { data: cat } = await supabase.from("categories").select("id").eq("slug", v.category).maybeSingle();
  const row = {
    professional_id: gate.userId,
    category_id: (cat as { id: string } | null)?.id ?? null,
    name: v.name,
    description: v.description || null,
    price_cents: Math.round(v.priceDollars * 100),
    price_is_from: v.priceIsFrom,
    duration_minutes: v.durationMin,
    location_type: v.locationType,
    buffer_before_minutes: v.bufferBeforeMin,
    buffer_after_minutes: v.bufferAfterMin,
    deposit_type: "percent",
    deposit_value: v.depositPercent ?? 20,
    travel_fee_cents: v.travelFeeDollars != null ? Math.round(v.travelFeeDollars * 100) : null,
    instant_book: v.instantBook,
    is_active: v.isActive,
  };

  if (serviceId) {
    // Ownership: the RLS update policy restricts to auth.uid() = professional_id.
    const { error } = await supabase.from("services").update(row).eq("id", serviceId).eq("professional_id", gate.userId);
    if (error) return { error: error.message };
  } else {
    const { error } = await supabase.from("services").insert(row);
    if (error) return { error: error.message };
  }
  revalidatePath("/pro/services");
  return { success: "Service saved." };
}

export async function archiveServiceAction(serviceId: string): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };
  const supabase = await createSupabaseServerClient();
  // Soft-delete: archived services never appear publicly (RLS + query filter deleted_at).
  const { error } = await supabase
    .from("services")
    .update({ deleted_at: new Date().toISOString(), is_active: false })
    .eq("id", serviceId)
    .eq("professional_id", gate.userId);
  if (error) return { error: error.message };
  revalidatePath("/pro/services");
  return { success: "Service archived." };
}

export async function saveAvailabilityAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };

  const raw = formData.get("payload");
  let payload: unknown;
  try {
    payload = JSON.parse(typeof raw === "string" ? raw : "{}");
  } catch {
    return { error: "Could not read availability." };
  }
  const parsed = availabilitySchema.safeParse(payload);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid availability." };
  const v = parsed.data;

  const supabase = await createSupabaseServerClient();
  await supabase
    .from("professional_profiles")
    .update({ timezone: v.timezone, min_notice_minutes: v.minNoticeMinutes, max_window_days: v.maxWindowDays })
    .eq("user_id", gate.userId);

  // Replace weekly rules atomically-ish (delete then insert own rows).
  await supabase.from("availability_rules").delete().eq("professional_id", gate.userId);
  if (v.windows.length > 0) {
    const rows = v.windows.map((w) => ({
      professional_id: gate.userId,
      weekday: w.weekday,
      start_minute: w.startMinute,
      end_minute: w.endMinute,
    }));
    const { error } = await supabase.from("availability_rules").insert(rows);
    if (error) return { error: error.message };
  }
  revalidatePath("/pro/availability");
  return { success: "Availability updated." };
}

export async function saveProfileAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };

  const parsed = profileSchema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Please fix the highlighted fields.", fieldErrors: fieldErrorsFrom(parsed.error) };
  const v = parsed.data;
  const list = (s?: string) => (s ? s.split(",").map((x) => x.trim()).filter(Boolean) : []);

  const supabase = await createSupabaseServerClient();
  // NOTE: is_active / is_verified are intentionally NOT settable here — a pro
  // cannot activate or verify themselves. Only admins/service-role can.
  const { error } = await supabase
    .from("professional_profiles")
    .update({
      business_name: v.businessName,
      primary_specialty: v.primarySpecialty,
      headline: v.headline || null,
      bio: v.bio || null,
      city: v.city || null,
      postal_code: v.postalCode || null,
      years_experience: v.yearsExperience ?? null,
      location_type: v.locationType,
      service_radius_miles: v.serviceRadiusMiles ?? null,
      languages: list(v.languages),
      specialties: list(v.specialties),
      instagram_handle: v.instagramHandle || null,
      cancellation_policy: v.cancellationPolicy || null,
    })
    .eq("user_id", gate.userId);
  if (error) return { error: error.message };
  revalidatePath("/pro/profile");
  return { success: "Profile saved." };
}

/** Upload a portfolio photo to Supabase Storage (public 'portfolio' bucket). */
export async function uploadPortfolioImageAction(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };
  const file = formData.get("file");
  if (!(file instanceof File) || file.size === 0) return { error: "Choose an image to upload." };
  if (!UPLOAD_LIMITS.mimes.includes(file.type as (typeof UPLOAD_LIMITS.mimes)[number])) {
    return { error: "Unsupported file type. Use JPEG, PNG, WebP, or AVIF." };
  }
  if (file.size > UPLOAD_LIMITS.maxBytes) {
    return { error: `That file is too large. Max ${UPLOAD_LIMITS.maxBytes / (1024 * 1024)} MB.` };
  }
  const admin = createAdminClient();
  const path = `${gate.userId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;
  const { error: upErr } = await admin.storage.from("portfolio").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) return { error: upErr.message };
  const { data: pub } = admin.storage.from("portfolio").getPublicUrl(path);

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("professional_portfolio_items")
    .insert({ professional_id: gate.userId, kind: "image", url: pub.publicUrl });
  if (error) return { error: error.message };
  revalidatePath("/pro/profile");
  revalidatePath("/onboarding/professional");
  return { success: "Photo added." };
}

/** Replace the professional's category assignments (multi-select). */
export async function saveCategoriesAction(slugs: string[]): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };
  const supabase = await createSupabaseServerClient();
  const { data: cats } = await supabase.from("professional_categories").select("id, slug");
  const ids = ((cats as { id: string; slug: string }[] | null) ?? [])
    .filter((c) => slugs.includes(c.slug))
    .map((c) => c.id);
  await supabase.from("professional_category_assignments").delete().eq("professional_id", gate.userId);
  if (ids.length) {
    const { error } = await supabase
      .from("professional_category_assignments")
      .insert(ids.map((category_id) => ({ professional_id: gate.userId, category_id })));
    if (error) return { error: error.message };
  }
  revalidatePath("/onboarding/professional");
  revalidatePath("/pro/profile");
  return { success: "Categories saved." };
}

export async function deletePortfolioItemAction(itemId: string): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("professional_portfolio_items")
    .delete()
    .eq("id", itemId)
    .eq("professional_id", gate.userId);
  if (error) return { error: error.message };
  revalidatePath("/pro/profile");
  return { success: "Removed." };
}

export async function setCoverPortfolioItemAction(itemId: string): Promise<ActionState> {
  const gate = await requirePro();
  if ("error" in gate) return { error: gate.error };
  const supabase = await createSupabaseServerClient();
  await supabase.from("professional_portfolio_items").update({ is_cover: false }).eq("professional_id", gate.userId);
  const { error } = await supabase
    .from("professional_portfolio_items")
    .update({ is_cover: true })
    .eq("id", itemId)
    .eq("professional_id", gate.userId);
  if (error) return { error: error.message };
  revalidatePath("/pro/profile");
  return { success: "Cover updated." };
}
