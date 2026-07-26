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
  SECTION_LABELS, validateForSubmit, isCredentialKind, currentAgreementAcceptances, sectionEditable,
  type ApplicationSection, type ReviewStatus, type AcceptedAgreement,
} from "@/lib/pro/application";
import type { LocationCompliance } from "@/lib/pro/compliance";

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
    businessName: initial.businessName,
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
  // Location + agreements live outside `data` because ServiceLocationStep saves
  // them itself; we hold the last-known persisted state to mirror submit gating.
  const [locationState, setLocationState] = useState<{
    locations: string[]; compliance: LocationCompliance; agreements: AcceptedAgreement[];
  }>({
    locations: initial.serviceLocations,
    compliance: initial.locationCompliance,
    agreements: initial.acceptedAgreements,
  });
  const [savedAt, setSavedAt] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [saveErr, setSaveErr] = useState<string | null>(null);
  const [submitErr, setSubmitErr] = useState<string | null>(null);
  const [submitting, startSubmit] = useTransition();
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSave = useRef<Promise<boolean>>(Promise.resolve(true));

  const status = initial.status as ReviewStatus;
  const flagged = initial.needsInfoSections;
  // Mirrors the server's rule exactly (draft + rejected: everything; needs_more_info:
  // flagged sections only) so the UI never offers an edit the server would refuse.
  const editable = useCallback(
    (s: ApplicationSection) => sectionEditable(status, flagged, s),
    [status, flagged],
  );

  const save = useCallback((next: typeof data): Promise<boolean> => {
    setSavedAt("saving");
    const request = (async () => {
      const r = await saveApplicationDraftAction({
        // Text fields are sent even when empty — "" is an explicit clear the
        // server persists (a cleared business name reverts to the pro's own
        // name; cleared years become null). `undefined` would silently keep the
        // old value while the UI says "Saved ✓".
        businessName: next.businessName,
        primarySpecialty: next.primarySpecialty || undefined,
        city: next.city,
        yearsExperience: next.yearsExperience === "" ? null : Number(next.yearsExperience),
        school: next.school,
        bio: next.bio,
        instagramHandle: next.instagramHandle,
        tiktokHandle: next.tiktokHandle,
        websiteUrl: next.websiteUrl,
        portfolioUrl: next.portfolioUrl,
      });
      setSavedAt(r.ok ? "saved" : "error");
      setSaveErr(r.ok ? null : r.error);
      // A cleared business name is stored as the pro's own name — reflect what
      // was actually saved, unless they've typed something new meanwhile.
      if (r.ok && r.data?.businessName) {
        const resolved = r.data.businessName;
        setData((d) => (d.businessName === "" ? { ...d, businessName: resolved } : d));
      }
      return r.ok;
    })();
    pendingSave.current = request;
    return request;
  }, []);

  // Debounced autosave whenever the form data changes.
  const persist = useCallback((next: typeof data) => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { void save(next); }, 800);
  }, [save]);
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
      // Legal prerequisites, mirrored from the server so the review step never
      // shows "ready to submit" for an application the server will reject.
      serviceLocations: locationState.locations,
      locationCompliance: locationState.compliance,
      acceptedAgreements: locationState.agreements,
    }),
    [data, initial.portfolioCount, initial.documents, locationState],
  );

  function submit() {
    setSubmitErr(null);
    startSubmit(async () => {
      // Drain an already-started save, cancel the debounce, then persist the
      // latest snapshot before validation/transition. This prevents slow saves
      // from landing after the application locks.
      if (timer.current) {
        clearTimeout(timer.current);
        timer.current = null;
      }
      await pendingSave.current;
      if (!(await save(data))) {
        setSubmitErr("Save your changes before submitting.");
        return;
      }
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

      {savedAt === "error" && saveErr && (
        <p role="alert" className="mb-3 rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger break-words">
          Couldn&apos;t save your changes: {saveErr}
        </p>
      )}

      {status === "needs_more_info" && (
        <div className="mb-4 rounded-[12px] border border-gold/40 bg-gold/10 px-4 py-3 text-sm text-ink-secondary">
          An admin asked for changes. You can only edit: <strong>{flagged.map((s) => SECTION_LABELS[s as ApplicationSection] ?? s).join(", ")}</strong>.
        </div>
      )}
      {status === "rejected" && (
        <div className="mb-4 rounded-[12px] border border-danger/40 bg-danger/10 px-4 py-3 text-sm text-ink-secondary break-words">
          <p><strong className="text-danger">Your previous application wasn&apos;t approved.</strong>{initial.rejectionReason ? <> Reason: {initial.rejectionReason}</> : null}</p>
          <p className="mt-1.5">You can update any section and resubmit. Your ID was deleted after review, so you&apos;ll need to upload it again in the Identity step.</p>
        </div>
      )}

      <div className="rounded-[18px] border border-border bg-surface p-5">
        {!onReview && locked && (
          <p className="mb-3 rounded-[10px] bg-bg-elevated px-3 py-2 text-[13px] text-ink-muted">This section is locked — no changes needed here.</p>
        )}

        {cur?.key === "basics" && (
          <div className="space-y-4">
            <div>
              <label className={label} htmlFor="bizname">Business name <span className="font-normal text-ink-muted">(optional)</span></label>
              <input id="bizname" disabled={locked} value={data.businessName} onChange={(e) => set("businessName", e.target.value)} maxLength={120} autoComplete="organization" className={input} placeholder="e.g. Glow Studio LA — leave blank to use your own name" />
            </div>
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
            initialLocations={locationState.locations}
            initialCompliance={locationState.compliance}
            onSaved={({ locations, compliance }) => {
              // The step only resolves after both agreements were accepted server-side.
              setLocationState({ locations, compliance, agreements: currentAgreementAcceptances() });
              setStep((st) => st + 1);
            }}
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
            <button type="button" disabled={errors.length > 0 || submitting || savedAt === "saving"} onClick={submit} className="min-h-[48px] w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-50">
              {submitting ? "Submitting…" : status === "needs_more_info" || status === "rejected" ? "Resubmit application" : "Submit application"}
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
