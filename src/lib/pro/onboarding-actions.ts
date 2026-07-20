"use server";
// Provider onboarding (Phase 13 beta). Minimum flow for a real user to become a
// provider: self-upgrade role customer -> professional (permitted by the
// prevent_role_escalation trigger), self-create their professional_profiles row
// (permitted by the "pro self insert" RLS policy), then submit for review.
//
// A new provider is NEVER public: is_active stays false (admin-only column guard)
// and review_status moves draft -> pending_review here. Only an admin approval
// (setProfessionalActiveAction) flips is_active=true + review_status='approved',
// which is the sole marketplace-visibility gate.
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { safeFilename } from "./schemas";

export type OnboardingState = { error?: string; success?: string } | undefined;

function slugFor(fullName: string | null, userId: string): string {
  const base = safeFilename(fullName || "stylist").replace(/\./g, "-").slice(0, 40) || "stylist";
  return `${base}-${userId.slice(0, 8)}`;
}

/**
 * Idempotent. Ensures the signed-in user is a professional with a draft profile
 * row. Safe to call more than once (no duplicate row — user_id is the PK).
 */
export async function startProviderOnboardingAction(): Promise<OnboardingState> {
  if (!isLiveSupabase()) return { error: "Connect Supabase to start onboarding." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const userId = auth.user.id;

  const { data: profile } = await supabase
    .from("profiles")
    .select("role, full_name")
    .eq("id", userId)
    .maybeSingle();
  const p = profile as { role?: string; full_name?: string | null } | null;
  if (!p) return { error: "Account not found." };
  if (p.role === "admin") return { error: "Admin accounts cannot onboard as a provider." };

  // Self-upgrade customer -> professional (allowed by prevent_role_escalation).
  if (p.role !== "professional") {
    const { error: roleErr } = await supabase.from("profiles").update({ role: "professional" }).eq("id", userId);
    if (roleErr) return { error: "Could not switch your account to a provider account." };
  }
  // A customer who becomes a provider keeps customer abilities → account_type 'both'.
  // No-ops gracefully until migration 0016 adds the column.
  await supabase
    .from("profiles")
    .update({ account_type: "both", active_mode: "professional" })
    .eq("id", userId)
    .eq("account_type", "customer");

  // Create the draft profile row if it doesn't exist yet.
  const { data: existing } = await supabase
    .from("professional_profiles")
    .select("user_id")
    .eq("user_id", userId)
    .maybeSingle();
  if (!existing) {
    const { error: insErr } = await supabase.from("professional_profiles").insert({
      user_id: userId,
      slug: slugFor(p.full_name ?? null, userId),
      business_name: p.full_name?.trim() || "My studio",
      // review_status defaults 'draft', is_active false, is_demo false.
    });
    if (insErr) return { error: insErr.message };
  }

  revalidatePath("/onboarding/professional");
  revalidatePath("/pro/profile");
  return { success: "Provider account created. Complete your profile below." };
}

/**
 * Submit the completed draft for admin review. Requires the core fields + at
 * least one active service and one availability window. Sets review_status =
 * 'pending_review'. Does NOT make the provider public.
 */
export async function submitProviderForReviewAction(): Promise<OnboardingState> {
  if (!isLiveSupabase()) return { error: "Connect Supabase to submit for review." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const userId = auth.user.id;

  const { data: pro } = await supabase
    .from("professional_profiles")
    .select("business_name, bio, city, avatar_url, review_status, is_active")
    .eq("user_id", userId)
    .maybeSingle();
  const row = pro as
    | { business_name?: string; bio?: string | null; city?: string | null; avatar_url?: string | null; review_status?: string; is_active?: boolean }
    | null;
  if (!row) return { error: "Start your provider profile first." };
  if (row.is_active) return { error: "Your profile is already live." };
  if (row.review_status === "pending_review") return { success: "Already submitted — an admin will review shortly." };

  const missing: string[] = [];
  if (!row.business_name || row.business_name === "My studio") missing.push("business name");
  if (!row.bio || row.bio.trim().length < 20) missing.push("a short bio");
  if (!row.city) missing.push("service area");

  const { count: serviceCount } = await supabase
    .from("services")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", userId)
    .eq("is_active", true);
  if (!serviceCount) missing.push("at least one service with a price");

  const { count: availCount } = await supabase
    .from("availability_rules")
    .select("id", { count: "exact", head: true })
    .eq("professional_id", userId);
  if (!availCount) missing.push("your availability");

  if (missing.length) return { error: `Please add ${missing.join(", ")} before submitting.` };

  const { error } = await supabase
    .from("professional_profiles")
    .update({ review_status: "pending_review", onboarding_complete: true })
    .eq("user_id", userId);
  if (error) return { error: error.message };

  revalidatePath("/onboarding/professional");
  return { success: "Submitted for review. We'll email you once you're approved." };
}
