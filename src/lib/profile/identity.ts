"use server";
// Lightweight viewer identity for header chrome (avatar + name). Runs with the
// user's own session; returns null for anonymous visitors.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { withTimeout } from "@/lib/util/timeout";

export interface ViewerIdentity {
  name: string;
  avatarUrl: string | null;
}

export async function getViewerIdentityAction(): Promise<ViewerIdentity | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await withTimeout(supabase.auth.getUser(), 6000, "auth.getUser");
  if (!auth.user) return null;
  const { data } = await withTimeout(
    supabase.from("profiles").select("first_name,last_name,full_name,avatar_url").eq("id", auth.user.id).maybeSingle(),
    6000,
    "viewer identity",
  );
  const p = (data ?? {}) as { first_name?: string | null; last_name?: string | null; full_name?: string | null; avatar_url?: string | null };
  const name =
    (p.full_name && p.full_name.trim()) ||
    [p.first_name, p.last_name].filter(Boolean).join(" ").trim() ||
    auth.user.email?.split("@")[0] ||
    "You";
  return { name, avatarUrl: p.avatar_url ?? null };
}
