"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { tipBookingAction, type TipState } from "@/lib/payments/tips";
import { formatPrice } from "@/lib/format";

export function TipForm({ bookingId, baseCents }: { bookingId: string; baseCents: number }) {
  const [preset, setPreset] = useState<number | null>(null); // cents
  const [custom, setCustom] = useState("");
  const [msg, setMsg] = useState<TipState>(undefined);
  const [pending, start] = useTransition();
  const router = useRouter();

  const options = [0.1, 0.15, 0.2].map((p) => ({ pct: p, cents: Math.max(100, Math.round(baseCents * p)) }));
  const customCents = custom ? Math.round(parseFloat(custom) * 100) : 0;
  const amount = preset ?? customCents;

  const send = () => {
    if (!Number.isInteger(amount) || amount < 100) { setMsg({ error: "Choose or enter a tip amount." }); return; }
    start(async () => {
      const res = await tipBookingAction(bookingId, amount);
      setMsg(res);
      if (res?.success) router.refresh();
    });
  };

  return (
    <div className="rounded-[16px] border border-border bg-surface p-4">
      <h3 className="mb-1 font-display text-base font-semibold">Add a tip</h3>
      <p className="mb-3 text-[12px] text-ink-muted">100% of your tip goes to your provider.</p>
      <div className="grid grid-cols-3 gap-2">
        {options.map((o) => (
          <button
            key={o.pct}
            type="button"
            aria-pressed={preset === o.cents}
            onClick={() => { setPreset(o.cents); setCustom(""); setMsg(undefined); }}
            className={`min-h-[52px] rounded-[12px] border text-center transition-colors ${
              preset === o.cents ? "border-rose bg-rose/10" : "border-border hover:border-rose/50"
            }`}
          >
            <span className="block text-sm font-semibold text-ink">{Math.round(o.pct * 100)}%</span>
            <span className="block text-[12px] text-ink-muted">{formatPrice(o.cents)}</span>
          </button>
        ))}
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-sm text-ink-muted">$</span>
        <input
          type="number"
          min={1}
          step="1"
          inputMode="decimal"
          value={custom}
          onChange={(e) => { setCustom(e.target.value); setPreset(null); setMsg(undefined); }}
          placeholder="Custom amount"
          className="w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none"
        />
      </div>
      {msg?.error && <p role="alert" className="mt-2 text-sm text-danger">{msg.error}</p>}
      {msg?.success && <p className="mt-2 text-sm text-rose">{msg.success}</p>}
      <button
        type="button"
        disabled={pending || amount < 100}
        onClick={send}
        className="mt-3 min-h-[44px] w-full rounded-full rose-gradient text-sm font-semibold text-[#2A1712] disabled:opacity-60"
      >
        {pending ? "Sending…" : amount >= 100 ? `Tip ${formatPrice(amount)}` : "Add a tip"}
      </button>
    </div>
  );
}
