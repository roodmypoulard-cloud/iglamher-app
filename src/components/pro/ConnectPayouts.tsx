"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { startConnectOnboardingAction, refreshConnectStatusAction } from "@/lib/payments/connect-actions";
import { formatPrice } from "@/lib/format";

export interface PayoutOverview {
  detailsSubmitted: boolean;
  payoutsEnabled: boolean;
  payoutsFrozen: boolean;
  pendingCents: number;
  availableCents: number;
  /** Stripe requirements.currently_due — fields still blocking payout. */
  currentlyDue: string[];
}

// Humanize Stripe's dotted requirement keys, e.g. "individual.verification.document".
function labelRequirement(key: string): string {
  const tail = key.split(".").filter((s) => s !== "individual" && s !== "company").join(" ");
  return (tail || key).replace(/[._]/g, " ").replace(/\bssn last 4\b/i, "SSN (last 4)").trim();
}

export function ConnectPayouts({ overview }: { overview: PayoutOverview }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const eligible = overview.payoutsEnabled && !overview.payoutsFrozen;

  const status = overview.payoutsFrozen
    ? { label: "Payouts on hold", tone: "text-danger" }
    : eligible
      ? { label: "Payouts active", tone: "text-success" }
      : overview.detailsSubmitted
        ? { label: "Verification in review", tone: "text-warning" }
        : { label: "Onboarding required", tone: "text-ink-muted" };

  return (
    <div className="card-luxe p-5">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-display text-lg font-semibold">Payouts</p>
          <p className={`mt-0.5 text-[12px] font-semibold ${status.tone}`}>{status.label}</p>
        </div>
        <div className="text-right">
          <p className="text-[11px] uppercase tracking-wide text-ink-muted">Available</p>
          <p className="font-display text-xl font-bold">{formatPrice(overview.availableCents)}</p>
          <p className="text-[11px] text-ink-muted">{formatPrice(overview.pendingCents)} pending</p>
        </div>
      </div>

      {!eligible && overview.currentlyDue.length > 0 && (
        <div className="mt-4 rounded-xl border border-warning/40 bg-warning/5 p-3">
          <p className="text-[12px] font-semibold text-warning">Still needed to unlock payouts</p>
          <ul className="mt-1.5 list-disc space-y-0.5 pl-4 text-[12px] text-ink-muted">
            {overview.currentlyDue.map((req) => (
              <li key={req}>{labelRequirement(req)}</li>
            ))}
          </ul>
        </div>
      )}

      {!eligible && (
        <div className="mt-4">
          <Button
            className="!w-auto px-6"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const r = await startConnectOnboardingAction();
                if (r.ok) window.location.href = r.url;
                else setError(r.error);
              })
            }
          >
            {overview.detailsSubmitted ? "Continue setup" : "Set up payouts"}
          </Button>
          {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
          <p className="mt-2 text-[11px] text-ink-muted">
            You&apos;ll finish adding your bank details and tax info on Stripe&apos;s secure page, then come right back.
            Stripe handles verification and your 1099 tax forms. Earnings are calculated from server-side values only.
          </p>
        </div>
      )}

      {eligible && (
        <button
          type="button"
          disabled={pending}
          onClick={() => start(async () => { await refreshConnectStatusAction(); window.location.reload(); })}
          className="mt-4 text-sm font-semibold text-rose hover:underline"
        >
          Refresh status
        </button>
      )}
    </div>
  );
}
