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
            {overview.detailsSubmitted ? "Continue verification" : "Set up payouts with Stripe"}
          </Button>
          {error && <p className="mt-2 text-[12px] text-danger">{error}</p>}
          <p className="mt-2 text-[11px] text-ink-muted">
            You must complete Stripe verification before receiving payouts. We calculate your earnings from server-side
            values only.
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
