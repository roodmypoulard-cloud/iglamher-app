"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit/log";

/**
 * Persist the active mode (customer/professional) and enter that mode's home.
 * Professional lands on /pro/services (the dashboard home); customer lands on
 * /profile so the switch is visibly reflected (mode pill + switcher).
 *
 * Hardened: the update selects the row back and verifies the stored mode matches
 * the requested one. A no-op update (row invisible to RLS, wrong id, column
 * missing) previously returned no error and still redirected — the UI looked
 * switched while active_mode never changed. Now any of those paths returns
 * { error } and does NOT redirect.
 */
export async function switchModeAction(
  mode: "customer" | "professional",
): Promise<{ error: string } | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  const { data: row, error } = await supabase
    .from("profiles")
    .update({ active_mode: mode })
    .eq("id", auth.user.id)
    .select("active_mode")
    .maybeSingle();

  if (error || !row || row.active_mode !== mode) {
    return { error: "Couldn't switch modes — please try again." };
  }

  await writeAudit({ actorId: auth.user.id, action: "account.mode_switch", entity: "user", entityId: auth.user.id, metadata: { mode } });
  revalidatePath("/", "layout");
  redirect(mode === "professional" ? "/pro/services" : "/profile");
}

/**
 * Form-safe actions for `<form action={...}>` in server components. On success
 * switchModeAction redirects (NEXT_REDIRECT propagates); on failure these THROW
 * so the error boundary surfaces it — a failed switch is never silent. (The old
 * enterModeAction awaited and discarded { error }, so the button looked dead.)
 */
export async function enterCustomerModeAction() {
  const res = await switchModeAction("customer");
  if (res?.error) throw new Error(res.error);
}

export async function enterProfessionalModeAction() {
  const res = await switchModeAction("professional");
  if (res?.error) throw new Error(res.error);
}
