"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { writeAudit } from "@/lib/audit/log";

/**
 * Persist the active mode (customer/professional) and enter that mode's home.
 * Professional lands on the Services tab — the dashboard home — not /pro/profile
 * (which is only the public-profile editor and reads as "nothing opened").
 * Customer lands on /profile so the switch is visibly reflected (mode pill +
 * switcher). Returns an error instead of redirecting if the DB update fails, so
 * the UI never silently pretends a failed switch worked. Only professional/both
 * accounts should reach this (UI-gated); RLS + the role check keep customer-only
 * accounts out of pro surfaces regardless.
 */
export async function switchModeAction(
  mode: "customer" | "professional",
): Promise<{ error: string } | undefined> {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  const { error } = await supabase.from("profiles").update({ active_mode: mode }).eq("id", auth.user.id);
  if (error) return { error: "Couldn't switch modes — please try again." };

  await writeAudit({ actorId: auth.user.id, action: "account.mode_switch", entity: "user", entityId: auth.user.id, metadata: { mode } });
  revalidatePath("/", "layout");
  redirect(mode === "professional" ? "/pro/services" : "/profile");
}

/**
 * Void wrapper for use directly as a `<form action>` in server components (which
 * can't pass a value-returning action without a type mismatch). Bind the mode:
 * `enterModeAction.bind(null, "customer")`. On success `switchModeAction` redirects;
 * on failure the wrapper returns and the page re-renders in place.
 */
export async function enterModeAction(mode: "customer" | "professional") {
  await switchModeAction(mode);
}
