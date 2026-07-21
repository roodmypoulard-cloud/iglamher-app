"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { redeemPointsAction } from "@/lib/loyalty/actions";
import { applyReferralCodeAction } from "@/lib/referral/actions";

export function RedeemBox({ points }: { points: number }) {
  const [pending, start] = useTransition();
  const [amount, setAmount] = useState(5);
  const [msg, setMsg] = useState<string | null>(null);
  return (
    <div className="card-luxe p-4">
      <p className="font-display text-lg font-semibold">Redeem points</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">100 points = $5 credit. You have {points} points.</p>
      <div className="mt-3 flex items-center gap-2">
        <div className="flex items-center rounded-[10px] border border-border bg-surface px-3">
          <span className="text-ink-muted">$</span>
          <input
            type="number" min={5} step={5} value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-16 bg-transparent py-2 text-ink outline-none"
          />
        </div>
        <Button
          variant="outline" className="!w-auto px-5"
          disabled={pending}
          onClick={() => start(async () => {
            const r = await redeemPointsAction({ discountCents: amount * 100 });
            setMsg(r.ok ? r.message : r.error);
          })}
        >
          Redeem
        </Button>
      </div>
      {msg && <p className="mt-2 text-[12px] text-ink-secondary">{msg}</p>}
    </div>
  );
}

export function ReferralBox({ code }: { code: string | null }) {
  const [copied, setCopied] = useState(false);
  const [applyCode, setApplyCode] = useState("");
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);

  return (
    <div className="card-luxe p-4">
      <p className="font-display text-lg font-semibold">Invite &amp; earn</p>
      <p className="mt-0.5 text-[12px] text-ink-muted">Share your code — you both get $15 credit when a friend books.</p>
      {code && (
        <div className="mt-3 flex items-center justify-between rounded-[10px] border border-rose/40 bg-rose/10 px-4 py-3">
          <span className="font-mono text-lg font-bold tracking-wide text-rose">{code}</span>
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(code).then(() => { setCopied(true); setTimeout(() => setCopied(false), 1500); }); }}
            className="text-sm font-semibold text-rose"
          >
            {copied ? "Copied!" : "Copy"}
          </button>
        </div>
      )}
      <div className="mt-4">
        <p className="mb-1.5 text-[12px] text-ink-muted">Have a friend&apos;s code?</p>
        <div className="flex items-center gap-2">
          <input
            value={applyCode} onChange={(e) => setApplyCode(e.target.value.toUpperCase())}
            placeholder="GLAM-XXXXXX"
            className="flex-1 rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus:border-rose"
          />
          <Button
            variant="ghost" className="!w-auto px-5" disabled={pending || applyCode.length < 4}
            onClick={() => start(async () => { const r = await applyReferralCodeAction(applyCode); setMsg(r.ok ? r.message : r.error); })}
          >
            Apply
          </Button>
        </div>
        {msg && <p className="mt-2 text-[12px] text-ink-secondary">{msg}</p>}
      </div>
    </div>
  );
}
