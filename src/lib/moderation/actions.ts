"use server";
// User-facing trust actions: report content, block/unblock accounts. Zod-validated,
// authenticated, RLS-backed. Reports feed the admin moderation queue.
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { rateLimitGuard } from "@/lib/security/guard";

export type ModResult = { ok: true } | { ok: false; error: string };

const reportSchema = z.object({
  targetType: z.enum(["user", "professional", "message", "review", "portfolio"]),
  targetId: z.string().uuid(),
  reason: z.enum(["harassment", "fraud", "spam", "inappropriate", "fake_profile", "safety", "copyright", "other"]),
  detail: z.string().max(1000).optional(),
});

export async function reportContentAction(raw: unknown): Promise<ModResult> {
  const limited = await rateLimitGuard("report");
  if (limited) return { ok: false, error: limited };
  const parsed = reportSchema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Invalid report." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to submit reports." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };
  const { error } = await supabase.from("content_reports").insert({
    reporter_id: auth.user.id,
    target_type: parsed.data.targetType,
    target_id: parsed.data.targetId,
    reason: parsed.data.reason,
    detail: parsed.data.detail ?? null,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function blockUserAction(blockedId: string): Promise<ModResult> {
  const limited = await rateLimitGuard("report");
  if (limited) return { ok: false, error: limited };
  if (!z.string().uuid().safeParse(blockedId).success) return { ok: false, error: "Invalid user." };
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to block users." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };
  if (auth.user.id === blockedId) return { ok: false, error: "You can't block yourself." };
  const { error } = await supabase.from("blocks").upsert({ blocker_id: auth.user.id, blocked_id: blockedId }, { onConflict: "blocker_id,blocked_id" });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export async function unblockUserAction(blockedId: string): Promise<ModResult> {
  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };
  const { error } = await supabase.from("blocks").delete().eq("blocker_id", auth.user.id).eq("blocked_id", blockedId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}
