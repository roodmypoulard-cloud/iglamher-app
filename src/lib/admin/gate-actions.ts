"use server";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { unlockGate, setGatePasscode, lockGate } from "@/lib/admin/gate";
import { writeAudit } from "@/lib/audit/log";

async function adminUserId(): Promise<string | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const { data } = await supabase.from("profiles").select("role").eq("id", auth.user.id).maybeSingle();
  return (data as { role?: string } | null)?.role === "admin" ? auth.user.id : null;
}

export type GateResult = { ok: true } | { ok: false; error: string };

/** Verify the passcode; on success set the unlock cookie and go to `next`. */
export async function unlockGateAction(_prev: GateResult | undefined, formData: FormData): Promise<GateResult> {
  const uid = await adminUserId();
  if (!uid) return { ok: false, error: "Admins only." };
  const passcode = String(formData.get("passcode") ?? "");
  const next = String(formData.get("next") ?? "/admin");
  const res = await unlockGate(uid, passcode);
  if (!res.ok) return { ok: false, error: res.error ?? "Couldn't unlock." };
  await writeAudit({ actorId: uid, action: "admin.gate.unlocked", entity: "admin_gate", entityId: "gate" });
  redirect(next.startsWith("/admin") ? next : "/admin");
}

/** Create or change the passcode (current required once one exists). */
export async function setGatePasscodeAction(_prev: GateResult | undefined, formData: FormData): Promise<GateResult> {
  const uid = await adminUserId();
  if (!uid) return { ok: false, error: "Admins only." };
  const next = String(formData.get("newPasscode") ?? "");
  const confirm = String(formData.get("confirmPasscode") ?? "");
  const current = String(formData.get("currentPasscode") ?? "") || undefined;
  if (next !== confirm) return { ok: false, error: "New passcodes don't match." };
  const res = await setGatePasscode(uid, next, current);
  if (!res.ok) return { ok: false, error: res.error ?? "Couldn't save." };
  await writeAudit({ actorId: uid, action: "admin.gate.passcode_changed", entity: "admin_gate", entityId: "gate" });
  return { ok: true };
}

/** Lock the admin area now (clear the unlock cookie). */
export async function lockGateAction(): Promise<void> {
  const uid = await adminUserId();
  if (uid) await writeAudit({ actorId: uid, action: "admin.gate.locked", entity: "admin_gate", entityId: "gate" });
  await lockGate();
  redirect("/admin-unlock");
}
