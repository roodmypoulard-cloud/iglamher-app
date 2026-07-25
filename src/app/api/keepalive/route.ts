import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";

// GET /api/keepalive — pinged by Vercel cron so the Supabase project always
// registers activity and free-tier auto-pause never triggers. Returns only a
// boolean; no data leaves this route.
export async function GET() {
  if (!isLiveSupabase()) {
    return NextResponse.json(
      { ok: false, reason: "not configured" },
      { headers: { "Cache-Control": "no-store" } },
    );
  }
  const { error } = await createAdminClient()
    .from("profiles")
    .select("id")
    .limit(1);
  return NextResponse.json(
    { ok: !error },
    { status: error ? 500 : 200, headers: { "Cache-Control": "no-store" } },
  );
}
