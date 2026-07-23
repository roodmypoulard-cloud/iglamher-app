"use client";
import { useState, useTransition } from "react";
import { setPlatformSettingAction } from "@/lib/ops/actions";

/** One platform kill-switch toggle. Server-validated (admin-only action + audit log). */
export function KillSwitch({
  settingKey,
  label,
  description,
  initialEnabled,
  danger = false,
}: {
  settingKey: string;
  label: string;
  description: string;
  initialEnabled: boolean;
  danger?: boolean;
}) {
  const [enabled, setEnabled] = useState(initialEnabled);
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-4">
      <div className="min-w-0 flex-1">
        <p className="text-sm font-bold text-ink">{label}</p>
        <p className="mt-0.5 text-[12px] leading-snug text-ink-muted">{description}</p>
        {error && <p role="alert" className="mt-1 text-[12px] text-danger">{error}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={enabled}
        aria-label={label}
        disabled={pending}
        onClick={() =>
          start(async () => {
            setError(null);
            const next = !enabled;
            const res = await setPlatformSettingAction(settingKey, { enabled: next });
            if (res.ok) setEnabled(next);
            else setError(res.error);
          })
        }
        className={`relative h-7 w-12 flex-none rounded-full transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/70 ${
          enabled ? (danger ? "bg-danger" : "bg-success") : "bg-border"
        }`}
      >
        <span
          aria-hidden
          className={`absolute top-0.5 h-6 w-6 rounded-full bg-bg-elevated shadow transition-[left] ${enabled ? "left-[22px]" : "left-0.5"}`}
        />
      </button>
    </div>
  );
}
