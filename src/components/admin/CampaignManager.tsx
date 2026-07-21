"use client";
import { useState, useTransition } from "react";
import { Button } from "@/components/ui/Button";
import { createCampaignAction, toggleCampaignAction } from "@/lib/marketing/actions";
import type { Campaign } from "@/lib/marketing/campaigns";

const input = "w-full rounded-[10px] border border-border bg-surface px-3 py-2 text-sm text-ink focus:border-rose";

export function CampaignManager({ initial }: { initial: Campaign[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [form, setForm] = useState({ name: "", type: "seasonal", discountType: "percent", discountValue: 15, cities: "" });

  function create() {
    start(async () => {
      const r = await createCampaignAction(form);
      setMsg(r.ok ? "Campaign created." : r.error);
    });
  }

  return (
    <div>
      <div className="card-luxe mb-6 p-5">
        <h2 className="mb-3 font-display text-lg font-semibold">New campaign</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input className={input} placeholder="Name (e.g. Summer Glow)" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <select className={input} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {["seasonal", "coupon", "geo", "abandoned_booking", "influencer"].map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
          <select className={input} value={form.discountType} onChange={(e) => setForm({ ...form, discountType: e.target.value })}>
            <option value="percent">Percent %</option>
            <option value="fixed">Fixed $ (cents)</option>
          </select>
          <input className={input} type="number" placeholder="Discount value" value={form.discountValue} onChange={(e) => setForm({ ...form, discountValue: Number(e.target.value) })} />
          <input className={`${input} sm:col-span-2`} placeholder="Cities (comma-separated, blank = everywhere)" value={form.cities} onChange={(e) => setForm({ ...form, cities: e.target.value })} />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <Button className="!w-auto px-6" disabled={pending || form.name.length < 2} onClick={create}>Create campaign</Button>
          {msg && <span className="text-[12px] text-ink-muted">{msg}</span>}
        </div>
      </div>

      <h2 className="mb-3 font-display text-lg font-semibold">Campaigns</h2>
      {initial.length === 0 ? (
        <p className="text-sm text-ink-muted">No campaigns yet.</p>
      ) : (
        <div className="space-y-2">
          {initial.map((c) => <CampaignRow key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

function CampaignRow({ c }: { c: Campaign }) {
  const [active, setActive] = useState(c.isActive);
  const [pending, start] = useTransition();
  return (
    <div className="flex items-center justify-between rounded-[12px] border border-border bg-surface px-4 py-3">
      <div>
        <p className="font-semibold">{c.name}</p>
        <p className="text-[12px] text-ink-muted">
          {c.type} · {c.discountType === "percent" ? `${c.discountValue}% off` : `$${(c.discountValue / 100).toFixed(0)} off`}
          {c.cities && c.cities.length > 0 ? ` · ${c.cities.join(", ")}` : ""}
        </p>
      </div>
      <button
        type="button" disabled={pending}
        onClick={() => start(async () => { const r = await toggleCampaignAction(c.id, !active); if (r.ok) setActive(!active); })}
        className={`rounded-full px-3 py-1 text-[12px] font-semibold ${active ? "bg-success/15 text-success" : "border border-border text-ink-muted"}`}
      >
        {active ? "Active" : "Paused"}
      </button>
    </div>
  );
}
