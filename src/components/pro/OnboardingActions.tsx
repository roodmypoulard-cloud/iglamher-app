"use client";
import { useTransition, useState } from "react";
import { useRouter } from "next/navigation";
import { startProviderOnboardingAction, submitProviderForReviewAction } from "@/lib/pro/onboarding-actions";

/** "Become a provider" — creates the provider account + draft profile row. */
export function StartOnboardingButton() {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const res = await startProviderOnboardingAction();
            if (res?.error) setError(res.error);
            else router.refresh();
          })
        }
        className="rounded-full rose-gradient px-6 py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60"
      >
        {pending ? "Setting up…" : "Become an iGlamHer pro"}
      </button>
      {error && <p role="alert" className="mt-3 text-sm text-danger">{error}</p>}
    </div>
  );
}

/** "Submit for review" — moves the draft to pending_review (admin approval next). */
export function SubmitForReviewButton() {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const router = useRouter();
  return (
    <div>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setMsg(null);
            const res = await submitProviderForReviewAction();
            setMsg(res ?? null);
            if (res?.success) router.refresh();
          })
        }
        className="rounded-full rose-gradient px-6 py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60"
      >
        {pending ? "Publishing…" : "Publish profile"}
      </button>
      {msg?.error && <p role="alert" className="mt-3 text-sm text-danger">{msg.error}</p>}
      {msg?.success && <p className="mt-3 text-sm text-rose">{msg.success}</p>}
    </div>
  );
}
