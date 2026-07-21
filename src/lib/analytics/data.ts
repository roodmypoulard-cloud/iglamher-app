import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import {
  platformMetrics, bookingFunnel, lifetimeValue, retentionRate, activeUsers, dailyGmv,
  type BookingFact, type EventFact, type PlatformMetrics,
} from "./metrics";

export interface AnalyticsReport {
  metrics: PlatformMetrics;
  funnel: { step: string; count: number; conversionFromTop: number }[];
  clv: { avgCents: number; maxCents: number };
  retention30: number;
  dau: number;
  mau: number;
  dailyGmv: { date: string; gmvCents: number }[];
}

export async function getPlatformAnalytics(nowIso = new Date().toISOString()): Promise<AnalyticsReport> {
  let bookings: BookingFact[] = [];
  let events: EventFact[] = [];

  if (isLiveSupabase()) {
    const admin = createAdminClient();
    const [{ data: b }, { data: e }] = await Promise.all([
      admin.from("bookings").select("id,customer_id,professional_id,status,total_cents,platform_fee_cents,created_at,starts_at").limit(20000),
      admin.from("analytics_events").select("user_id,event,created_at").limit(5000),
    ]);
    bookings = ((b as unknown as Array<Record<string, unknown>>) ?? []).map((r) => ({
      id: String(r.id), customerId: String(r.customer_id), professionalId: String(r.professional_id),
      status: String(r.status), totalCents: Number(r.total_cents ?? 0), platformFeeCents: Number(r.platform_fee_cents ?? 0),
      createdAt: String(r.created_at), startsAt: String(r.starts_at),
    }));
    events = ((e as unknown as Array<Record<string, unknown>>) ?? []).map((r) => ({
      userId: (r.user_id as string) ?? null, event: String(r.event), createdAt: String(r.created_at),
    }));
  }

  return {
    metrics: platformMetrics(bookings),
    funnel: bookingFunnel(events),
    clv: lifetimeValue(bookings),
    retention30: retentionRate(bookings, 30),
    dau: activeUsers(events, nowIso, 1),
    mau: activeUsers(events, nowIso, 30),
    dailyGmv: dailyGmv(bookings),
  };
}
