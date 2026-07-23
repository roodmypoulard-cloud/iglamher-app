"use client";
import { useState, useTransition } from "react";
import Link from "next/link";
import { setProfessionalActiveAction, setProfessionalFeaturedAction, setProfessionalRecommendedAction } from "@/lib/admin/actions";

export function AdminProRow({
  userId,
  active,
  featured,
  recommended = false,
}: {
  userId: string;
  active: boolean;
  featured: boolean;
  recommended?: boolean;
}) {
  const [isActive, setActive] = useState(active);
  const [isFeatured, setFeatured] = useState(featured);
  const [isRecommended, setRecommended] = useState(recommended);
  const [pending, start] = useTransition();
  const [err, setErr] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-2">
      {/* Visibility toggle only — this never approves. Activating succeeds only for a
          pro already approved via the application review; new applicants are sent
          there via the Review link. */}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            setErr(null);
            const res = await setProfessionalActiveAction(userId, !isActive);
            if (res.ok) setActive(!isActive);
            else setErr(res.error);
          })
        }
        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
          isActive ? "bg-success/15 text-success" : "border border-border text-ink-muted"
        }`}
      >
        {isActive ? "Live · Deactivate" : "Activate"}
      </button>
      <Link
        href={`/admin/applications/${userId}`}
        className="rounded-full border border-border px-3 py-1 text-[12px] font-semibold text-ink-muted hover:border-rose/50"
      >
        Review
      </Link>
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setProfessionalFeaturedAction(userId, !isFeatured);
            if (res.ok) setFeatured(!isFeatured);
            else setErr(res.error);
          })
        }
        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
          isFeatured ? "rose-gradient text-[#2A1712]" : "border border-border text-ink-muted"
        }`}
      >
        {isFeatured ? "Featured" : "Feature"}
      </button>
      {/* Curated placement — free at launch, becomes the $2.99/mo paid slot. */}
      <button
        type="button"
        disabled={pending}
        onClick={() =>
          start(async () => {
            const res = await setProfessionalRecommendedAction(userId, !isRecommended);
            if (res.ok) setRecommended(!isRecommended);
            else setErr(res.error);
          })
        }
        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${
          isRecommended ? "gold-glossy" : "border border-border text-ink-muted"
        }`}
      >
        {isRecommended ? "★ Recommended" : "Recommend"}
      </button>
      {err && <span className="text-[11px] text-danger">{err}</span>}
    </div>
  );
}
