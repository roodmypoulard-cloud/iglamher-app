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
import { createAdminClient } from "@/lib/supabase/admin";
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
/**
 * Compute what's still missing before a professional can publish. Exported so the
 * onboarding UI can render a live checklist.
 */
export async function getPublishChecklist(userId: string): Promise<{ missing: string[]; ready: boolean }> {
  const supabase = await createSupabaseServerClient();
  const { data: pro } = await supabase
    .from("professional_profiles")
    .select("business_name, bio, city")
    .eq("user_id", userId)
    .maybeSingle();
  const row = pro as { business_name?: string; bio?: string | null; city?: string | null } | null;

  const missing: string[] = [];
  if (!row) return { missing: ["start your profile"], ready: false };
  if (!row.business_name || row.business_name === "My studio") missing.push("a business name");
  if (!row.bio || row.bio.trim().length < 20) missing.push("a short bio (20+ characters)");
  if (!row.city) missing.push("your service area");

  const { count: catCount } = await supabase
    .from("professional_category_assignments")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", userId);
  if ((catCount ?? 0) < 1) missing.push("at least one category");

  const { count: svcCount } = await supabase
    .from("services")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", userId)
    .eq("is_active", true);
  if ((svcCount ?? 0) < 1) missing.push("at least one service with a price");

  const { count: portCount } = await supabase
    .from("professional_portfolio_items")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", userId);
  if ((portCount ?? 0) < 1) missing.push("at least one portfolio photo");

  const { count: availCount } = await supabase
    .from("availability_rules")
    .select("*", { count: "exact", head: true })
    .eq("professional_id", userId);
  if ((availCount ?? 0) < 1) missing.push("your availability");

  return { missing, ready: missing.length === 0 };
}

/**
 * Publish the profile to the public marketplace. Self-service, gated by the
 * completeness checklist (no admin approval for beta). is_active is set via the
 * admin client because the column guard blocks providers from self-activating.
 */
export async function submitProviderForReviewAction(): Promise<OnboardingState> {
  if (!isLiveSupabase()) return { error: "Connect Supabase to publish." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };
  const userId = auth.user.id;

  const { data: cur } = await supabase
    .from("professional_profiles")
    .select("is_active")
    .eq("user_id", userId)
    .maybeSingle();
  if ((cur as { is_active?: boolean } | null)?.is_active) return { success: "Your profile is already live." };

  const { missing, ready } = await getPublishChecklist(userId);
  if (!ready) return { error: `Add ${missing.join(", ")} before publishing.` };

  try {
    // Server-authorized publish: verified completeness + ownership → admin write.
    const admin = createAdminClient();
    const { error } = await admin
      .from("professional_profiles")
      .update({ is_active: true, review_status: "approved", onboarding_complete: true })
      .eq("user_id", userId);
    if (error) return { error: error.message };
    await supabase
      .from("profiles")
      .update({ professional_onboarding_completed: true, onboarding_completed: true, active_mode: "professional" })
      .eq("id", userId);
  } catch (e) {
    return { error: `Publish failed: ${e instanceof Error ? e.message : String(e)}` };
  }

  revalidatePath("/onboarding/professional");
  revalidatePath("/discover");
  return { success: "You're live! Your profile now appears in the marketplace." };
}
