import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { syncConnectStatus } from "@/lib/payments/connect";
import type { PayoutOverview } from "@/components/pro/ConnectPayouts";
import type { BookingFact } from "@/lib/analytics/metrics";
import {
  providerEarnings, repeatCustomerRate, weeklyEarnings, forecastNextPeriodCents,
  optimizationSuggestions, type ProviderEarnings, type OptimizationSuggestion,
} from "./provider-metrics";

export interface ProviderGrowthReport {
  earnings: ProviderEarnings;
  repeatRate: number;
  weekly: { weekStart: string; netCents: number }[];
  forecastNextWeekCents: number;
  suggestions: OptimizationSuggestion[];
  available: boolean;
}

const EMPTY: ProviderGrowthReport = {
  earnings: { grossCents: 0, platformFeesCents: 0, netEarningsCents: 0, completedJobs: 0, avgTicketCents: 0 },
  repeatRate: 0, weekly: [], forecastNextWeekCents: 0, suggestions: [], available: false,
};

const EMPTY_PAYOUT: PayoutOverview = { detailsSubmitted: false, payoutsEnabled: false, payoutsFrozen: false, pendingCents: 0, availableCents: 0, currentlyDue: [] };

/** Payout onboarding state + earnings-ledger balances (server-side trusted). */
export async function getPayoutOverview(): Promise<PayoutOverview> {
  if (!isLiveSupabase()) return EMPTY_PAYOUT;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return EMPTY_PAYOUT;

  const { data: prof } = await supabase
    .from("professional_profiles")
    .select("connect_details_submitted, connect_payouts_enabled, payouts_frozen, stripe_account_id")
    .eq("user_id", auth.user.id)
    .maybeSingle();
  const p = prof as { connect_details_submitted?: boolean; connect_payouts_enabled?: boolean; payouts_frozen?: boolean; stripe_account_id?: string } | null;

  // When payouts aren't live yet, pull Stripe's outstanding requirements so the UI
  // can tell the pro exactly what's blocking them. Best-effort — never block the page.
  let currentlyDue: string[] = [];
  if (p?.stripe_account_id && !p.connect_payouts_enabled) {
    try {
      currentlyDue = (await syncConnectStatus(auth.user.id)).currentlyDue;
    } catch {
      currentlyDue = [];
    }
  }

  const { data: ledger } = await supabase
    .from("earnings_ledger")
    .select("amount_cents, status")
    .eq("professional_id", auth.user.id)
    .limit(5000);
  const rows = (ledger as unknown as Array<{ amount_cents: number; status: string }>) ?? [];
  const sum = (s: string) => rows.filter((r) => r.status === s).reduce((a, r) => a + r.amount_cents, 0);

  return {
    detailsSubmitted: Boolean(p?.connect_details_submitted),
    payoutsEnabled: Boolean(p?.connect_payouts_enabled),
    payoutsFrozen: Boolean(p?.payouts_frozen),
    pendingCents: Math.max(0, sum("pending")),
    availableCents: Math.max(0, sum("available")),
    currentlyDue,
  };
}

export async function getMyProviderGrowth(cancellationRate = 0): Promise<ProviderGrowthReport> {
  if (!isLiveSupabase()) return EMPTY;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return EMPTY;

  const { data } = await supabase
    .from("bookings")
    .select("id,customer_id,professional_id,status,total_cents,platform_fee_cents,created_at,starts_at")
    .eq("professional_id", auth.user.id)
    .limit(2000);

  const bookings: BookingFact[] = ((data as unknown as Array<Record<string, unknown>>) ?? []).map((r) => ({
    id: String(r.id), customerId: String(r.customer_id), professionalId: String(r.professional_id),
    status: String(r.status), totalCents: Number(r.total_cents ?? 0), platformFeeCents: Number(r.platform_fee_cents ?? 0),
    createdAt: String(r.created_at), startsAt: String(r.starts_at),
  }));

  const earnings = providerEarnings(bookings);
  const weekly = weeklyEarnings(bookings, 8);
  const completionRate = earnings.completedJobs / Math.max(1, earnings.completedJobs);
  return {
    earnings,
    repeatRate: repeatCustomerRate(bookings),
    weekly,
    forecastNextWeekCents: forecastNextPeriodCents(weekly.map((w) => w.netCents)),
    suggestions: optimizationSuggestions({
      utilization: 0.5, cancellationRate, completionRate,
      avgTicketCents: earnings.avgTicketCents, marketAvgTicketCents: 12000,
    }),
    available: true,
  };
}
