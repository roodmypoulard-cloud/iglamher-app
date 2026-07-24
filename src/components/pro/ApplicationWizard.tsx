"use client";
import { useCallback, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PortfolioManager } from "@/components/pro/PortfolioManager";
import { DocumentUploader } from "@/components/pro/DocumentUploader";
import { ServiceLocationStep } from "@/components/pro/ServiceLocationStep";
import {
  saveApplicationDraftAction, submitApplicationAction, type MyApplication,
} from "@/lib/pro/application-actions";
import {
  SECTION_LABELS, validateForSubmit, isCredentialKind, type ApplicationSection, type ReviewStatus,
} from "@/lib/pro/application";

type PortfolioRow = Parameters<typeof PortfolioManager>[0]["items"];

const CATEGORIES = ["hair", "makeup", "lashes", "nails", "stylist"] as const;
const input = "w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none";
const label = "mb-1.5 block text-sm font-semibold text-ink";

const STEPS: { key: ApplicationSection; title: string }[] = [
  { key: "basics", title: "Basics" },
  { key: "portfolio", title: "Portfolio" },
  { key: "social", title: "Links" },
  { key: "location", title: "Location" },
  { key: "documents", title: "Certifications" },
  { key: "identity", title: "Identity" },
];

export function ApplicationWizard({ initial, portfolio }: { initial: MyApplication; portfolio: PortfolioRow }) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [data, setData] = useState({
    primarySpecialty: initial.primarySpecialty,
    city: initial.city,
    yearsExperience: initial.yearsExperience?.toString() ?? "",
    school: initial.school,
    bio: initial.bio,
    instagramHandle: initial.instagramHandle,
    tiktokHandle: initial.tiktokHandle,
    websiteUrl: initial.websiteUrl,
    portfolioUrl: initial.portfolioUrl,
  });
  const [savedAt, setSavedAt] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const status = initial.status as ReviewStatus;
  const flagged = initial.needsInfoSections;
  const editable = useCallback(
    (s: ApplicationSection) => status === "draft" || (status === "needs_more_info" && flagged.includes(s)),
    [status, flagged],
  );

  // Debounced autosave whenever the form data changes.
  const persist = useCallback((next: typeof data) => {
    if (timer.current) clearTimeout(timer.current);
    setSavedAt("saving");
    timer.current = setTimeout(async () => {
      const r = await saveApplicationDraftAction({
        primarySpecialty: next.primarySpecialty || undefined,
        city: next.city || undefined,
        yearsExperience: next.yearsExperience ? Number(next.yearsExperience) : undefined,
        school: next.school || undefined,
        bio: next.bio || undefined,
        instagramHandle: next.instagramHandle,
        tiktokHandle: next.tiktokHandle,
        websiteUrl: next.websiteUrl,
        portfolioUrl: next.portfolioUrl,
      });
      setSavedAt(r.ok ? "saved" : "error");
    }, 800);
  }, []);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  function set<K extends keyof typeof data>(k: K, v: string) {
    setData((d) => { const n = { ...d, [k]: v }; persist(n); return n; });
  }

  const errors = useMemo(
    () => validateForSubmit({
      primarySpecialty: data.primarySpecialty, city: data.city,
      yearsExperience: data.yearsExperience ? Number(data.yearsExperience) : null, school: data.school, bio: data.bio,
      instagramHandle: data.instagramHandle, tiktokHandle: data.tiktokHandle, websiteUrl: data.websiteUrl, portfolioUrl: data.portfolioUrl,
      portfolioCount: initial.portfolioCount, hasIdDocument: initial.documents.some((d) => d.kind === "id_document"),
      hasCredentialDocument: initial.documents.some((d) => isCredentialKind(d.kind)),
    }),
    [data, initial.portfolioCount, initial.documents],
  );

  function submit() {
    setSubmitErr(null);
    startSubmit(async () => {
      const r = await submitApplicationAction();
      if (r.ok) router.push("/pro/application");
      else setSubmitErr(r.error);
    });
  }

  const cur = STEPS[step];
  const onReview = step === STEPS.length;
  // On the Review step `cur` is undefined (step === STEPS.length), so don't deref it.
  const locked = cur ? !editable(cur.key) : false;

  return (
    <div>
      {/* Progress */}
      <div className="mb-6 flex items-center gap-1.5">
        {STEPS.map((s, i) => (
          <div key={s.key} className={`h-1 flex-1 rounded-full ${i < step ? "bg-rose" : i === step ? "rose-gradient" : "bg-surface"}`} />
        ))}
        <div className={`h-1 flex-1 rounded-full ${onReview ? "rose-gradient" : "bg-surface"}`} />
      </div>
      <div className="mb-1 flex items-center justify-between">
        <p className="text-[12px] font-semibold uppercase tracking-wide text-ink-muted">
          Step {step + 1} of {STEPS.length + 1} · {onReview ? "Review & submit" : cur.title}
        </p>
        <span className="text-[11px] text-ink-muted">
          {savedAt === "saving" ? "Saving…" : savedAt === "saved" ? "Saved ✓" : savedAt === "error" ? "Save failed" : ""}
        </span>
      </div>

      {status === "needs_more_info" && (
        <div className="mb-4 rounded-[12px] border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink-secondary">
          An admin asked for changes. You can only edit: <strong>{flagged.map((s) => SECTION_LABELS[s as ApplicationSection] ?? s).join(", ")}</strong>.
        </div>
      )}

      <div className="rounded-[18px] border border-border bg-surface p-5">
        {!onReview && locked && (
          <p className="mb-3 rounded-[10px] bg-bg-elevated px-3 py-2 text-[13px] text-ink-muted">This section is locked — no changes needed here.</p>
        )}

        {cur?.key === "basics" && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="cat">Main service category</label>
              <select id="cat" disabled={locked} value={data.primarySpecialty} onChange={(e) => set("primarySpecialty", e.target.value)} className={input}>
                <option value="">Select…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c[0].toUpperCase() + c.slice(1)}</option>)}
              </select>
            </div>
            <div><label className={label} htmlFor="city">City / service area</label><input id="city" disabled={locked} value={data.city} onChange={(e) => set("city", e.target.value)} className={input} placeholder="Los Angeles, CA" /></div>
            <div><label className={label} htmlFor="yrs">Years of experience</label><input id="yrs" disabled={locked} inputMode="numeric" value={data.yearsExperience} onChange={(e) => set("yearsExperience", e.target.value.replace(/\D/g, "").slice(0, 2))} className={input} placeholder="5" /></div>
            <div><label className={label} htmlFor="school">School / training program</label><input id="school" disabled={locked} value={data.school} onChange={(e) => set("school", e.target.value)} className={input} placeholder="e.g. Empire Beauty School, or where you trained" /></div>
            <div><label className={label} htmlFor="bio">Short bio</label><textarea id="bio" disabled={locked} value={data.bio} onChange={(e) => set("bio", e.target.value)} rows={4} className={input} placeholder="Tell clients about your style and specialties (min 30 characters)." /></div>
          </div>
        )}

        {cur?.key === "portfolio" && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">Upload 3–10 photos of your work, <em>or</em> add a link to your portfolio site.</p>
            {editable("portfolio") ? <PortfolioManager items={portfolio} /> : <p className="text-sm text-ink-muted">{initial.portfolioCount} photos uploaded.</p>}
            <div><label className={label} htmlFor="purl">Portfolio link (optional if you uploaded photos)</label><input id="purl" disabled={locked} value={data.portfolioUrl} onChange={(e) => set("portfolioUrl", e.target.value)} className={input} placeholder="https://…" /></div>
          </div>
        )}

        {cur?.key === "social" && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">Add at least one: Instagram, TikTok, or website.</p>
            <div><label className={label} htmlFor="ig">Instagram handle</label><input id="ig" disabled={locked} value={data.instagramHandle} onChange={(e) => set("instagramHandle", e.target.value)} className={input} placeholder="yourhandle" /></div>
            <div><label className={label} htmlFor="tt">TikTok handle</label><input id="tt" disabled={locked} value={data.tiktokHandle} onChange={(e) => set("tiktokHandle", e.target.value)} className={input} placeholder="yourhandle" /></div>
            <div><label className={label} htmlFor="web">Website</label><input id="web" disabled={locked} value={data.websiteUrl} onChange={(e) => set("websiteUrl", e.target.value)} className={input} placeholder="https://…" /></div>
          </div>
        )}

        {cur?.key === "location" && (
          <ServiceLocationStep
            initialLocations={[]}
            initialCompliance={{}}
            onSaved={() => setStep((st) => st + 1)}
            onBack={() => setStep((st) => Math.max(0, st - 1))}
          />
        )}

        {cur?.key === "documents" && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary"><strong className="text-ink">Required:</strong> upload at least one certification, license, diploma, or certificate (PDF, JPG, or PNG). This is what our team verifies before your profile goes live.</p>
            <DocumentUploader kind="certification" title="Certifications" documents={initial.documents} disabled={!editable("documents")} />
            <DocumentUploader kind="license" title="Licenses" documents={initial.documents} disabled={!editable("documents")} />
          </div>
        )}

        {cur?.key === "identity" && (
          <div className="space-y-4">
            <p className="text-sm text-ink-secondary">Upload a clear photo of a government ID (driver&apos;s license or passport) so we can confirm you&apos;re a real person.</p>
            <div className="flex items-start gap-2.5 rounded-[12px] border border-success/40 bg-success/10 px-4 py-3">
              <svg viewBox="0 0 24 24" width={18} height={18} fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 flex-none text-success" aria-hidden><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
              <p className="text-[13px] text-ink-secondary"><strong className="text-ink">Your ID is not stored.</strong> It&apos;s used only to verify you and is <strong>permanently deleted the moment our team reviews your application</strong> — we never keep it on file.</p>
            </div>
            <DocumentUploader kind="id_document" title="Government ID" documents={initial.documents} disabled={!editable("identity")} />
          </div>
        )}

        {onReview && (
          <div className="space-y-4">
            <h3 className="font-display text-lg font-semibold">Review &amp; submit</h3>
            {errors.length > 0 ? (
              <div className="rounded-[12px] border border-warning/40 bg-warning/10 p-4">
                <p className="text-sm font-semibold text-warning">Before you submit, please fix:</p>
                <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-ink-secondary">{errors.map((e, i) => <li key={i}>{e}</li>)}</ul>
              </div>
            ) : (
              <p className="rounded-[12px] border border-success/40 bg-success/10 px-4 py-3 text-sm text-success">Everything looks good. Submit for review — you&apos;ll hear back by email.</p>
            )}
            {submitErr && <p role="alert" className="text-sm text-danger">{submitErr}</p>}
            <button type="button" disabled={errors.length > 0 || submitting} onClick={submit} className="min-h-[48px] w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-50">
              {submitting ? "Submitting…" : status === "needs_more_info" ? "Resubmit application" : "Submit application"}
            </button>
          </div>
        )}
      </div>

      {/* Nav — the Location step renders its own Back/Continue (it must save first). */}
      {cur?.key !== "location" && (
      <div className="mt-5 flex items-center justify-between">
        <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} disabled={step === 0} className="min-h-[44px] rounded-full border border-border px-5 text-sm font-semibold text-ink-muted disabled:opacity-40">← Back</button>
        {!onReview ? (
          <button type="button" onClick={() => setStep((s) => s + 1)} className="min-h-[44px] rounded-full rose-gradient px-6 text-sm font-semibold text-[#2A1712]">Next →</button>
        ) : (
          <span className="text-[12px] text-ink-muted">Autosaved — you can leave and finish later.</span>
        )}
      </div>
      )}
    </div>
  );
}
