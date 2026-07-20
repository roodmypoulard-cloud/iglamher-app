"use server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Persist the active mode (customer/professional) and enter that mode's home.
 * Only professional/both accounts should reach this (UI-gated); RLS + the role
 * check keep customer-only accounts out of pro surfaces regardless.
 */
export async function switchModeAction(mode: "customer" | "professional") {
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) redirect("/signin");

  await supabase.from("profiles").update({ active_mode: mode }).eq("id", auth.user.id);
  revalidatePath("/", "layout");
  redirect(mode === "professional" ? "/pro/profile" : "/discover");
}
