"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { startProviderOnboardingAction } from "@/lib/pro/onboarding-actions";
import { ModeSwitcher } from "@/components/profile/ModeSwitcher";
import { SparkleIcon } from "@/components/ui/icons";

/**
 * Account card. Customer accounts get the "become a professional" upgrade (same
 * account, no new signup). Professional/both accounts get the Account Type + Current
 * Mode rows and the two large mode cards. The professional dashboard entry lives once
 * at the page level (not here), so there's a single dashboard CTA.
 */
export function AccountTypeSettings({
  accountType,
  activeMode,
}: {
  accountType: "customer" | "professional" | "both";
  activeMode: "customer" | "professional";
}) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const label =
    accountType === "both" ? "Customer & Professional" : accountType === "professional" ? "Beauty Professional" : "Customer";

  if (accountType === "customer") {
    return (
      <div className="card-luxe px-4 py-4">
        <div className="flex items-center justify-between">
          <span className="text-sm text-ink-muted">Account type</span>
          <span className="text-sm font-semibold text-ink">{label}</span>
        </div>
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="mb-3 text-[13px] text-ink-muted">
            Want to offer your services? Become a beauty professional — same account, no new signup.
          </p>
          <button
            type="button"
            disabled={pending}
            onClick={() =>
              start(async () => {
                setError(null);
                const res = await startProviderOnboardingAction();
                if (res?.error) setError(res.error);
                else router.push("/onboarding/professional");
              })
            }
            className="rounded-full rose-gradient px-5 py-2.5 text-sm font-semibold text-[#2A1712] disabled:opacity-60"
          >
            {pending ? "Setting up…" : "Become a beauty professional"}
          </button>
          {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className="card-luxe space-y-4 px-4 py-4">
      {/* Account type */}
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">Account type</span>
        <span className="flex items-center gap-1.5 text-sm font-semibold text-rose">
          {label}
          <SparkleIcon width={15} height={15} />
        </span>
      </div>

      {/* Current mode */}
      <div className="flex items-center justify-between border-t border-border/60 pt-4">
        <span className="text-sm text-ink-muted">Current mode</span>
        <span className="text-sm font-semibold text-rose">
          {activeMode === "professional" ? "Professional Mode" : "Customer Mode"}
        </span>
      </div>

      {/* Two large mode cards */}
      <ModeSwitcher activeMode={activeMode} />
    </div>
  );
}
