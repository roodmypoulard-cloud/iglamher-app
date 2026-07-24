"use client";
import { useState } from "react";
import { cn } from "@/lib/format";
import {
  SERVICE_LOCATIONS, HOME_STUDIO_QUESTIONS, PRO_AGREEMENTS, PRO_AGREEMENT_KEYS,
  ADDRESS_PRIVACY_NOTE, homeStudioNeedsReview, needsHomeStudioAnswers,
  missingRequiredHomeStudioAnswers,
  type ServiceLocationKey, type LocationCompliance, type YesNo,
} from "@/lib/pro/compliance";
import { saveServiceLocationsAction, acceptProAgreementsAction } from "@/lib/pro/compliance-actions";

const ICON: Record<ServiceLocationKey, React.ReactNode> = {
  home_studio: <path d="M4 11 12 4l8 7M6 10v9h12v-9M10 19v-5h4v5" />,
  client_location: <><circle cx="12" cy="9" r="3" /><path d="M12 21s-6-5-6-11a6 6 0 0 1 12 0c0 6-6 11-6 11Z" /></>,
  salon_suite: <><rect x="4" y="4" width="16" height="16" rx="2" /><path d="M4 9h16M9 20V9" /></>,
  commercial_studio: <><path d="M4 20V8l8-4 8 4v12" /><path d="M9 20v-6h6v6M4 12h16" /></>,
  multiple: <><circle cx="7" cy="8" r="2.5" /><circle cx="17" cy="8" r="2.5" /><path d="M3 19c0-2.6 1.8-4.5 4-4.5s4 1.9 4 4.5M13 19c0-2.6 1.8-4.5 4-4.5s4 1.9 4 4.5" /></>,
};

/** Step 3 — Where do you provide services? Location cards + home-studio
 *  compliance + the two mandatory legal agreements. Saves on continue. */
export function ServiceLocationStep({
  initialLocations = [],
  initialCompliance = {},
  onSaved,
  onBack,
}: {
  initialLocations?: string[];
  initialCompliance?: LocationCompliance;
  /** Reports what was persisted so the wizard's review step can mirror it. */
  onSaved: (saved: { locations: string[]; compliance: LocationCompliance }) => void;
  onBack: () => void;
}) {
  const [locations, setLocations] = useState<Set<string>>(new Set(initialLocations));
  const [compliance, setCompliance] = useState<LocationCompliance>(initialCompliance);
  const [hidePin, setHidePin] = useState(true);
  const [agreed, setAgreed] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Only surface "you missed one" highlighting after a blocked Continue, so the
  // form doesn't scold before the pro has had a chance to answer.
  const [showMissing, setShowMissing] = useState(false);

  const showHome = needsHomeStudioAnswers([...locations]);
  const bothAgreed = PRO_AGREEMENT_KEYS.every((k) => agreed.has(k));
  const flagged = showHome && homeStudioNeedsReview(compliance);
  const missing = showHome ? missingRequiredHomeStudioAnswers(compliance) : [];
  const missingSet = new Set<string>(missing);

  const toggleLoc = (k: string) =>
    setLocations((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k); else next.add(k);
      return next;
    });

  async function save() {
    setError(null);
    if (locations.size === 0) { setError("Select at least one place you provide services."); return; }
    if (missing.length > 0) {
      setShowMissing(true);
      setError(`Answer every required home studio question — ${missing.length} still ${missing.length === 1 ? "needs" : "need"} a Yes or No.`);
      return;
    }
    if (!bothAgreed) { setError("Please accept both professional agreements to continue."); return; }
    setSaving(true);
    const saved = [...locations];
    const [locRes, agrRes] = await Promise.all([
      saveServiceLocationsAction({ locations: saved, compliance, hideExactPin: hidePin }),
      acceptProAgreementsAction([...agreed]),
    ]);
    setSaving(false);
    if (!locRes.ok) { setError(locRes.error); return; }
    if (!agrRes.ok) { setError(agrRes.error); return; }
    onSaved({ locations: saved, compliance });
  }

  return (
    <div className="space-y-5">
      <div>
        <h3 className="font-display text-[20px] font-bold text-ink">Where do you provide your services?</h3>
        <p className="mt-1 text-[12.5px] text-ink-secondary">Select all that apply. This helps clients find you and tells us what to verify.</p>
      </div>

      <div className="grid gap-2.5">
        {SERVICE_LOCATIONS.map((l) => {
          const on = locations.has(l.key);
          return (
            <button
              key={l.key}
              type="button"
              aria-pressed={on}
              onClick={() => toggleLoc(l.key)}
              className={cn(
                "flex items-start gap-3 rounded-[16px] border p-3.5 text-left transition-[border-color,background-color,box-shadow] duration-200",
                on ? "border-gold/70 bg-gold/[0.06] shadow-[0_0_16px_rgba(201,154,75,0.18)]" : "border-rose/25 bg-surface hover:border-rose/45",
              )}
            >
              <span className={cn("grid h-10 w-10 flex-none place-items-center rounded-full", on ? "gold-glossy" : "bg-rose/10 text-rose")}>
                <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden className={on ? "text-[#2a1c08]" : undefined}>
                  {ICON[l.key]}
                </svg>
              </span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-1.5 text-[14px] font-bold text-ink">{l.label}
                  {on && <svg viewBox="0 0 24 24" width={15} height={15} className="text-gold" fill="currentColor" aria-hidden><path d="M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z" /></svg>}
                </span>
                <span className="mt-0.5 block text-[11.5px] leading-snug text-ink-muted">{l.desc}</span>
              </span>
            </button>
          );
        })}
      </div>

      {/* Home-studio compliance */}
      {showHome && (
        <div className="rounded-[16px] border border-rose/25 bg-surface p-4">
          <p className="text-[13px] font-bold text-ink">Home studio details</p>
          <p className="mt-0.5 text-[11.5px] text-ink-muted">
            A few questions so we can review your home-based location. Questions marked <span className="text-rose">*</span> are required.
          </p>
          <div className="mt-3 space-y-2.5">
            {HOME_STUDIO_QUESTIONS.map((q) => {
              const unanswered = showMissing && missingSet.has(q.key);
              return (
                <div
                  key={q.key}
                  role="group"
                  aria-labelledby={`hsq-${q.key}`}
                  className={cn(
                    "flex items-start justify-between gap-3 rounded-[12px] transition-colors",
                    unanswered && "-mx-2 border border-danger/40 bg-danger/[0.05] px-2 py-1.5",
                  )}
                >
                  <span id={`hsq-${q.key}`} className="min-w-0 flex-1 text-[12px] leading-snug text-ink-secondary">
                    {q.label}{q.required && <span className="text-rose"> *</span>}
                    {unanswered && <span className="mt-0.5 block text-[11px] font-semibold text-danger">Please answer this question.</span>}
                  </span>
                  <div className="flex flex-none gap-1.5">
                    {(["yes", "no"] as YesNo[]).map((v) => (
                      <button
                        key={v}
                        type="button"
                        aria-pressed={compliance[q.key] === v}
                        onClick={() => setCompliance((p) => ({ ...p, [q.key]: v }))}
                        className={cn(
                          "min-h-[32px] rounded-full px-3 text-[11.5px] font-semibold transition-colors",
                          compliance[q.key] === v
                            ? v === "yes" ? "bg-success/20 text-success" : "bg-warning/20 text-warning"
                            : unanswered
                              ? "border border-danger/45 text-ink-secondary hover:text-ink"
                              : "border border-border text-ink-muted hover:text-ink-secondary",
                        )}
                      >
                        {v === "yes" ? "Yes" : "No"}
                      </button>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          {flagged && (
            <p className="mt-3 rounded-[12px] border border-warning/40 bg-warning/[0.08] px-3 py-2 text-[11.5px] leading-snug text-warning">
              This location may require additional documentation or approval before clients can book services here. It will be flagged for review — you can still finish your application.
            </p>
          )}
          <label className="mt-3 flex cursor-pointer items-start gap-2 text-[12px] text-ink-secondary">
            <input type="checkbox" checked={hidePin} onChange={(e) => setHidePin(e.target.checked)} className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-rose)]" />
            <span>
              Hide my exact map pin until a booking is confirmed
              <span className="mt-0.5 block text-[11px] leading-snug text-ink-muted">{ADDRESS_PRIVACY_NOTE}</span>
            </span>
          </label>
        </div>
      )}

      {/* Mandatory legal agreements */}
      <div className="rounded-[16px] border border-gold/30 bg-gold/[0.04] p-4">
        <p className="text-[13px] font-bold text-ink">Before you continue</p>
        <div className="mt-2.5 space-y-3">
          {PRO_AGREEMENT_KEYS.map((k) => (
            <label key={k} className="flex cursor-pointer items-start gap-2.5 text-[11.5px] leading-relaxed text-ink-secondary">
              <input
                type="checkbox"
                checked={agreed.has(k)}
                onChange={(e) =>
                  setAgreed((p) => {
                    const n = new Set(p);
                    if (e.target.checked) n.add(k); else n.delete(k);
                    return n;
                  })
                }
                className="mt-0.5 h-4 w-4 flex-none accent-[var(--color-rose)]"
              />
              <span>{PRO_AGREEMENTS[k].text}</span>
            </label>
          ))}
        </div>
      </div>

      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}

      <div className="flex gap-2.5">
        <button type="button" onClick={onBack} className="min-h-[46px] flex-none rounded-full border border-border px-5 text-[13px] font-semibold text-ink-secondary">
          Back
        </button>
        <button
          type="button"
          onClick={save}
          disabled={saving}
          className="min-h-[46px] flex-1 rounded-full rose-gradient text-[14px] font-bold text-[#2A1712] disabled:opacity-60"
        >
          {saving ? "Saving…" : "Continue"}
        </button>
      </div>
    </div>
  );
}
