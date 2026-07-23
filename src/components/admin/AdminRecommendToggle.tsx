"use client";
import { useState, useTransition } from "react";
import { setProfessionalRecommendedAction } from "@/lib/admin/actions";

/** Featured-placement switch for the recommendations roster (admin-gated server action + audit). */
export function AdminRecommendToggle({ userId, initialRecommended }: { userId: string; initialRecommended: boolean }) {
  const [on, setOn] = useState(initialRecommended);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label="Featured placement"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const next = !on;
            const res = await setProfessionalRecommendedAction(userId, next);
            if (res.ok) setOn(next);
            else setError(res.error);
          })
        }
        className={`relative h-6 w-11 rounded-full transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/70 ${on ? "rose-gradient" : "bg-border"}`}
      >
        <span aria-hidden className={`absolute top-0.5 h-5 w-5 rounded-full bg-bg-elevated shadow transition-[left] ${on ? "left-[22px]" : "left-0.5"}`} />
      </button>
      {error && <p role="alert" className="mt-1 text-[10px] text-danger">{error}</p>}
    </div>
  );
}
