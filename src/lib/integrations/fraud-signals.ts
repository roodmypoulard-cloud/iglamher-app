import "server-only";
// Fraud-signal collection abstraction. Interface + a FingerprintJS provider
// (env-gated) + a local collector that derives signals from data we already have.
// Feeds the tested scoreFraud() engine from Phase 6.
import { isConfigured } from "./config";
import type { FraudSignals } from "@/lib/trust/fraud";

export interface FraudSignalProvider {
  name: string;
  /** Enrich partial signals with vendor data (device/IP reputation). */
  enrich(partial: Partial<FraudSignals>, ctx: { visitorId?: string; ip?: string }): Promise<Partial<FraudSignals>>;
}

class LocalProvider implements FraudSignalProvider {
  name = "local";
  async enrich(partial: Partial<FraudSignals>): Promise<Partial<FraudSignals>> {
    // No vendor: rely on DB-derived signals (account age, cancellation rate,
    // shared payment method, booking velocity) computed by the caller.
    return partial;
  }
}

class FingerprintProvider implements FraudSignalProvider {
  name = "fingerprintjs";
  async enrich(partial: Partial<FraudSignals>): Promise<Partial<FraudSignals>> {
    // Integration point: GET https://api.fpjs.io with FINGERPRINT_API_KEY + visitorId,
    // to fill sharedDeviceAccounts, distinctLocationsLast24h (impossible travel), VPN flags.
    return partial;
  }
}

export function getFraudSignalProvider(): FraudSignalProvider {
  return isConfigured("fingerprint_fraud") ? new FingerprintProvider() : new LocalProvider();
}

/** Merge DB-derived signals with vendor enrichment into a complete signal set. */
export async function collectFraudSignals(
  dbSignals: Partial<FraudSignals>,
  ctx: { visitorId?: string; ip?: string } = {},
): Promise<FraudSignals> {
  const enriched = await getFraudSignalProvider().enrich(dbSignals, ctx);
  return {
    accountAgeHours: enriched.accountAgeHours ?? 9999,
    sharedPaymentMethodAccounts: enriched.sharedPaymentMethodAccounts ?? 0,
    sharedDeviceAccounts: enriched.sharedDeviceAccounts ?? 0,
    bookingsLast24h: enriched.bookingsLast24h ?? 0,
    cancellationRate: enriched.cancellationRate ?? 0,
    chargebackCount: enriched.chargebackCount ?? 0,
    distinctLocationsLast24h: enriched.distinctLocationsLast24h ?? 1,
    reviewsWrittenLast24h: enriched.reviewsWrittenLast24h ?? 0,
    failedPaymentsLast24h: enriched.failedPaymentsLast24h ?? 0,
  };
}
