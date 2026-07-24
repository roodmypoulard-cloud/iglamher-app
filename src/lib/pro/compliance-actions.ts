"use server";
// Service-location + compliance + legal-agreement server actions. All run with
// the user's own session (RLS enforces ownership); needs_location_review is set
// via the service-role admin client because the column guard makes it
// platform-only. Agreement acceptance is captured with IP + user-agent as proof.
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import {
  SERVICE_LOCATIONS, HOME_STUDIO_QUESTIONS, PRO_AGREEMENTS, PRO_AGREEMENT_KEYS,
  homeStudioNeedsReview, needsHomeStudioAnswers, requiredHomeStudioAnswered,
  type ServiceLocationKey, type LocationCompliance, type ProAgreementKey,
} from "./compliance";

export type ComplianceResult = { ok: true } | { ok: false; error: string };

const LOCATION_KEYS = new Set(SERVICE_LOCATIONS.map((l) => l.key));
const QUESTION_KEYS = new Set(HOME_STUDIO_QUESTIONS.map((q) => q.key));

async function requirePro(): Promise<{ error: string } | { userId: string }> {
  if (!isLiveSupabase()) return { error: "Connect a Supabase project first." };
  const supabase = await createSupabaseServerClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return { error: "Please sign in." };
  return { userId: data.user.id };
}

/** Save the pro's declared service locations + home-studio compliance answers.
 *  Flags the profile for admin review when a required answer is "no". */
export async function saveServiceLocationsAction(input: {
  locations: string[];
  compliance: LocationCompliance;
  hideExactPin?: boolean;
}): Promise<ComplianceResult> {
  const gate = await requirePro();
  if ("error" in gate) return { ok: false, error: gate.error };

  const locations = (input.locations ?? []).filter((l): l is ServiceLocationKey => LOCATION_KEYS.has(l as ServiceLocationKey));
  if (locations.length === 0) return { ok: false, error: "Select where you provide services." };

  const compliance: LocationCompliance = {};
  for (const [k, v] of Object.entries(input.compliance ?? {})) {
    if (QUESTION_KEYS.has(k as never) && (v === "yes" || v === "no")) compliance[k as keyof LocationCompliance] = v;
  }

  const isHome = needsHomeStudioAnswers(locations);
  // Hard block: every required home-studio question needs an explicit yes/no.
  // Unanswered is not the same as "no" — "no" saves and flags for review.
  if (isHome && !requiredHomeStudioAnswered(compliance)) {
    return { ok: false, error: "Answer every required home studio question before continuing." };
  }
  const needsReview = isHome && homeStudioNeedsReview(compliance);

  // Owner-editable declaration fields via the user's client (RLS: own row).
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase
    .from("professional_profiles")
    .update({ service_locations: locations, location_compliance: compliance, hide_exact_pin: input.hideExactPin ?? true })
    .eq("user_id", gate.userId);
  if (error) return { ok: false, error: "Couldn't save your locations. Please try again." };

  // needs_location_review is platform-only (column guard) → service-role write.
  const admin = createAdminClient();
  await admin.from("professional_profiles").update({ needs_location_review: needsReview }).eq("user_id", gate.userId);

  revalidatePath("/pro/apply");
  revalidatePath("/pro/application");
  return { ok: true };
}

/** Record acceptance of the required professional agreements with proof
 *  (timestamp handled by DB default; IP + user-agent captured here). Idempotent
 *  per (user, key, version): re-accepting the same version is a no-op insert. */
export async function acceptProAgreementsAction(keys: string[]): Promise<ComplianceResult> {
  const gate = await requirePro();
  if ("error" in gate) return { ok: false, error: gate.error };

  const accepted = (keys ?? []).filter((k): k is ProAgreementKey => PRO_AGREEMENT_KEYS.includes(k as ProAgreementKey));
  // BOTH agreements are mandatory before submitting.
  if (PRO_AGREEMENT_KEYS.some((k) => !accepted.includes(k))) {
    return { ok: false, error: "You must accept both professional agreements to continue." };
  }

  const hdrs = await headers();
  const ip = hdrs.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
  const ua = hdrs.get("user-agent") ?? null;

  const supabase = await createSupabaseServerClient();
  // De-dupe: skip versions already on file for this user.
  const { data: existing } = await supabase
    .from("professional_agreements")
    .select("agreement_key, version")
    .eq("user_id", gate.userId);
  const have = new Set(((existing ?? []) as Array<{ agreement_key: string; version: string }>).map((r) => `${r.agreement_key}@${r.version}`));

  const rows = accepted
    .filter((k) => !have.has(`${k}@${PRO_AGREEMENTS[k].version}`))
    .map((k) => ({ user_id: gate.userId, agreement_key: k, version: PRO_AGREEMENTS[k].version, ip, user_agent: ua }));

  if (rows.length > 0) {
    const { error } = await supabase.from("professional_agreements").insert(rows);
    if (error) return { ok: false, error: "Couldn't record your agreement. Please try again." };
  }
  return { ok: true };
}
