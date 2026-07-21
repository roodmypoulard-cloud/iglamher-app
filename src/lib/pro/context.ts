import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getProfessionalByUserId } from "@/lib/data/professionals";
import { PROFESSIONALS } from "@/lib/data/seed";
import type { Professional } from "@/lib/data/model";

export interface ProContext {
  userId: string;
  pro: Professional | null;
  /** true when rendering the demo pro locally (no live auth/db). */
  isDemo: boolean;
}

/**
 * Resolve the signed-in professional. Returns { authed:false } when a live DB is
 * connected but no user is present (caller should redirect to sign in). In local
 * dev (no Supabase) we surface a demo professional so the dashboard renders.
 */
export async function getProContext(): Promise<ProContext & { authed: boolean }> {
  if (!isLiveSupabase()) {
    const demo = PROFESSIONALS[0];
    return { authed: true, isDemo: true, userId: demo.userId, pro: demo };
  }
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { authed: false, isDemo: false, userId: "", pro: null };
  const pro = await getProfessionalByUserId(auth.user.id);
  return { authed: true, isDemo: false, userId: auth.user.id, pro };
}
