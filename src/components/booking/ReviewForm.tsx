"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { submitReviewAction, type ReviewState } from "@/lib/reviews/actions";

function StarInput({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  const [hover, setHover] = useState(0);
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-ink">{label}</span>
      <div className="flex gap-0.5" role="radiogroup" aria-label={label}>
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            type="button"
            role="radio"
            aria-label={`${n} star${n > 1 ? "s" : ""}`}
            aria-checked={value === n}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            onClick={() => onChange(n)}
            className="min-h-[36px] min-w-[32px] text-2xl leading-none transition-transform active:scale-90"
          >
            <span className={(hover || value) >= n ? "text-gold" : "text-border"}>★</span>
          </button>
        ))}
      </div>
    </div>
  );
}

const CATEGORIES: Record<"customer_to_pro" | "pro_to_customer", { key: string; label: string }[]> = {
  customer_to_pro: [
    { key: "quality", label: "Quality" },
    { key: "punctuality", label: "Punctuality" },
    { key: "professionalism", label: "Professionalism" },
    { key: "communication", label: "Communication" },
  ],
  pro_to_customer: [
    { key: "punctuality", label: "Punctuality" },
    { key: "communication", label: "Communication" },
    { key: "respectfulness", label: "Respectfulness" },
  ],
};

export function ReviewForm({
  bookingId,
  direction,
}: {
  bookingId: string;
  direction: "customer_to_pro" | "pro_to_customer";
}) {
  const [rating, setRating] = useState(0);
  const [cats, setCats] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<ReviewState>(undefined);
  const [pending, start] = useTransition();
  const router = useRouter();

  const submit = (formData: FormData) => {
    if (rating < 1) { setMsg({ error: "Please choose a 1–5 star rating." }); return; }
    formData.set("rating", String(rating));
    formData.set("direction", direction);
    for (const [k, val] of Object.entries(cats)) if (val) formData.set(k, String(val));
    start(async () => {
      const res = await submitReviewAction(bookingId, undefined, formData);
      setMsg(res);
      if (res?.success) router.refresh();
    });
  };

  const title = direction === "customer_to_pro" ? "Review your provider" : "Review your client";

  return (
    <form action={submit} className="rounded-[16px] border border-border bg-surface p-4">
      <h3 className="mb-3 font-display text-base font-semibold">{title}</h3>
      <StarInput value={rating} onChange={setRating} label="Overall" />
      <div className="mt-3 space-y-2 border-t border-border/60 pt-3">
        {CATEGORIES[direction].map((c) => (
          <StarInput key={c.key} value={cats[c.key] ?? 0} onChange={(n) => setCats((s) => ({ ...s, [c.key]: n }))} label={c.label} />
        ))}
      </div>
      <textarea
        name="body"
        rows={3}
        maxLength={1500}
        placeholder="Share the details of your experience (optional)…"
        className="mt-3 w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none"
      />
      {msg?.error && <p role="alert" className="mt-2 text-sm text-danger">{msg.error}</p>}
      {msg?.success && <p className="mt-2 text-sm text-rose">{msg.success}</p>}
      <button type="submit" disabled={pending} className="mt-3 min-h-[44px] w-full rounded-full rose-gradient text-sm font-semibold text-[#2A1712] disabled:opacity-60">
        {pending ? "Posting…" : "Post review"}
      </button>
    </form>
  );
}
