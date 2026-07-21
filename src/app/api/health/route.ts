import { NextResponse } from "next/server";
import { isLiveSupabase } from "@/lib/data/source";
import { isStripeConfigured } from "@/lib/payments/stripe";
import { integrationStatus } from "@/lib/integrations/config";

export const dynamic = "force-dynamic";

// GET /api/health — liveness + configuration readiness. Never leaks secrets;
// returns which subsystems are configured for a load balancer / uptime monitor.
export async function GET() {
  const checks = {
    app: true,
    database: isLiveSupabase(),
    payments: isStripeConfigured(),
  };
  const configured = integrationStatus().filter((i) => i.configured).map((i) => i.key);
  const ok = checks.app; // app liveness; DB/payments are readiness, not liveness

  return NextResponse.json(
    {
      status: ok ? "ok" : "degraded",
      checks,
      integrations: { configured, total: integrationStatus().length },
      time: new Date().toISOString(),
    },
    { status: ok ? 200 : 503, headers: { "Cache-Control": "no-store" } },
  );
}
