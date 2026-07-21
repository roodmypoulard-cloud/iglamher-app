"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { startProviderOnboardingAction } from "@/lib/pro/onboarding-actions";
import { ModeSwitcher } from "@/components/profile/ModeSwitcher";

/**
 * Settings control for account type. A customer can become a beauty professional
 * (upgrades to "both") without creating a second account; a professional/both
 * account gets the customer/professional mode switch. No new account is ever made.
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

  return (
    <div className="card-luxe px-4 py-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-ink-muted">Account type</span>
        <span className="text-sm font-semibold text-ink">{label}</span>
      </div>

      {accountType === "customer" ? (
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
      ) : (
        <div className="mt-4 border-t border-border/60 pt-4">
          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Mode</p>
          <ModeSwitcher activeMode={activeMode} />
          <Link href="/pro/profile" className="mt-3 inline-block text-sm font-semibold text-rose hover:underline">
            Professional dashboard →
          </Link>
        </div>
      )}
    </div>
  );
}
