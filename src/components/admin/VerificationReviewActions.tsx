"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  approveApplicationAction, rejectApplicationAction, needsMoreInfoAction, addInternalNoteAction,
  banProfessionalAction, suspendProfessionalAction, reactivateProfessionalAction,
} from "@/lib/admin/verification-actions";
import { APPLICATION_SECTIONS, SECTION_LABELS, type ApplicationSection } from "@/lib/pro/application";

type Mode = null | "approve" | "reject" | "needs";
type AcctMode = null | "ban" | "suspend";
type AccountStatus = "active" | "suspended" | "banned";

export function VerificationReviewActions({
  userId, businessName, locked, accountStatus, unmetRequirements,
}: {
  userId: string;
  businessName: string;
  locked: boolean;
  accountStatus: AccountStatus;
  unmetRequirements: string[];
}) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode>(null);
  const [reason, setReason] = useState("");
  const [note, setNote] = useState("");
  const [sections, setSections] = useState<ApplicationSection[]>([]);
  const [internal, setInternal] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    start(async () => {
      const r = await fn();
      if (r.ok) { setMode(null); router.refresh(); }
      else setError(r.error ?? "Something went wrong.");
    });
  }

  const toggle = (s: ApplicationSection) => setSections((p) => (p.includes(s) ? p.filter((x) => x !== s) : [...p, s]));
  const banned = accountStatus === "banned";
  const canApprove = unmetRequirements.length === 0 && !banned;

  return (
    <div className="space-y-5">
      {/* ---- Application decision ---- */}
      {!locked && !banned && (
        <div className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
          <h3 className="font-display text-lg font-semibold">Decision</h3>
          {error && <p role="alert" className="text-sm text-danger">{error}</p>}

          {!canApprove && mode === null && (
            <div className="rounded-[12px] border border-warning/40 bg-warning/10 px-3.5 py-3 text-[13px] text-warning">
              <p className="font-semibold">Approval is blocked until:</p>
              <ul className="mt-1 list-disc space-y-0.5 pl-4">
                {unmetRequirements.map((u) => <li key={u}>{u}</li>)}
              </ul>
            </div>
          )}

          {mode === null && (
            <div className="flex flex-wrap gap-2">
              <button type="button" disabled={!canApprove} onClick={() => setMode("approve")} className="min-h-[44px] rounded-full rose-gradient px-5 py-2.5 text-sm font-semibold text-[#2A1712] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40">Approve</button>
              <button type="button" onClick={() => setMode("needs")} className="min-h-[44px] rounded-full border border-gold/50 px-5 py-2.5 text-sm font-semibold text-gold active:scale-[0.98]">Request changes</button>
              <button type="button" onClick={() => setMode("reject")} className="min-h-[44px] rounded-full border border-danger/50 px-5 py-2.5 text-sm font-semibold text-danger active:scale-[0.98]">Reject</button>
            </div>
          )}

          {mode === "approve" && (
            <div className="space-y-3">
              <p className="text-sm text-ink-secondary">Approve this pro? They&apos;ll go live in the marketplace, get the verified badge, and receive an approval email. Their ID is deleted on approval.</p>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => approveApplicationAction(userId))} className="min-h-[44px] rounded-full rose-gradient px-6 py-2.5 text-sm font-semibold text-[#2A1712] disabled:opacity-60">{busy ? "Approving…" : "Confirm approve"}</button>
                <button type="button" onClick={() => setMode(null)} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted">Cancel</button>
              </div>
            </div>
          )}

          {mode === "reject" && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink">Reason (emailed to the applicant) — required</label>
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={3} className="w-full rounded-[12px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none" placeholder="e.g. Portfolio photos don't show your own work; ID was unreadable." />
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => rejectApplicationAction(userId, reason))} className="min-h-[44px] rounded-full border border-danger px-6 py-2.5 text-sm font-semibold text-danger disabled:opacity-60">{busy ? "Rejecting…" : "Confirm reject"}</button>
                <button type="button" onClick={() => setMode(null)} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted">Cancel</button>
              </div>
            </div>
          )}

          {mode === "needs" && (
            <div className="space-y-3">
              <label className="block text-sm font-semibold text-ink">What do they need to fix? (emailed) — required</label>
              <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} className="w-full rounded-[12px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none" placeholder="e.g. Please re-upload a clearer photo of your certification." />
              <p className="text-sm font-semibold text-ink">Sections they can re-edit — select at least one</p>
              <div className="flex flex-wrap gap-2">
                {APPLICATION_SECTIONS.map((s) => (
                  <button key={s} type="button" onClick={() => toggle(s)} className={`min-h-[40px] rounded-full border px-3.5 py-2 text-[13px] font-medium ${sections.includes(s) ? "border-rose bg-rose/10 text-rose" : "border-border text-ink-secondary"}`}>
                    {SECTION_LABELS[s]}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button type="button" disabled={busy} onClick={() => run(() => needsMoreInfoAction(userId, note, sections))} className="min-h-[44px] rounded-full border border-gold px-6 py-2.5 text-sm font-semibold text-gold disabled:opacity-60">{busy ? "Sending…" : "Send request"}</button>
                <button type="button" onClick={() => setMode(null)} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted">Cancel</button>
              </div>
            </div>
          )}
        </div>
      )}

      {locked && !banned && (
        <div className="rounded-[16px] border border-border bg-surface p-5">
          <p className="text-sm text-ink-muted">This application has already been decided. You can still take account action or add a note below.</p>
        </div>
      )}

      {/* ---- Account moderation (independent of the application) ---- */}
      <AccountControls
        userId={userId} businessName={businessName} accountStatus={accountStatus}
        busy={busy} error={error} run={run}
      />

      {/* ---- Internal note (always available) ---- */}
      <div className="rounded-[16px] border border-border bg-surface p-5">
        <InternalNote internal={internal} setInternal={setInternal} busy={busy} onSave={() => run(() => addInternalNoteAction(userId, internal).then((r) => { if (r.ok) setInternal(""); return r; }))} />
      </div>
    </div>
  );
}

function AccountControls({
  userId, businessName, accountStatus, busy, error, run,
}: {
  userId: string;
  businessName: string;
  accountStatus: AccountStatus;
  busy: boolean;
  error: string | null;
  run: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [acctMode, setAcctMode] = useState<AcctMode>(null);
  const [banReason, setBanReason] = useState("");
  const [confirmName, setConfirmName] = useState("");
  const [suspendReason, setSuspendReason] = useState("");

  if (accountStatus === "banned") {
    return (
      <div className="space-y-3 rounded-[16px] border border-danger/50 bg-danger/10 p-5">
        <h3 className="font-display text-lg font-semibold text-danger">Account banned</h3>
        <p className="text-sm text-ink-secondary">This account is hidden everywhere and cannot re-apply. Reactivating restores access (it does not re-verify them).</p>
        <button type="button" disabled={busy} onClick={() => run(() => reactivateProfessionalAction(userId))} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60">Reactivate account</button>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-[16px] border border-border bg-surface p-5">
      <h3 className="font-display text-lg font-semibold">Account</h3>
      {error && acctMode && <p role="alert" className="text-sm text-danger">{error}</p>}

      {accountStatus === "suspended" && acctMode === null && (
        <div className="space-y-2">
          <p className="rounded-[10px] bg-warning/10 px-3 py-2 text-[13px] text-warning">This account is suspended (hidden + blocked).</p>
          <button type="button" disabled={busy} onClick={() => run(() => reactivateProfessionalAction(userId))} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink disabled:opacity-60">Reactivate</button>
        </div>
      )}

      {acctMode === null && accountStatus === "active" && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setAcctMode("suspend")} className="min-h-[44px] rounded-full border border-warning/50 px-5 py-2.5 text-sm font-semibold text-warning">Suspend</button>
          <button type="button" onClick={() => setAcctMode("ban")} className="min-h-[44px] rounded-full border border-danger/60 bg-danger/5 px-5 py-2.5 text-sm font-semibold text-danger">Ban…</button>
        </div>
      )}
      {acctMode === null && accountStatus === "suspended" && (
        <button type="button" onClick={() => setAcctMode("ban")} className="min-h-[44px] rounded-full border border-danger/60 bg-danger/5 px-5 py-2.5 text-sm font-semibold text-danger">Ban…</button>
      )}

      {acctMode === "suspend" && (
        <div className="space-y-3">
          <label className="block text-sm font-semibold text-ink">Reason for suspension</label>
          <textarea value={suspendReason} onChange={(e) => setSuspendReason(e.target.value)} rows={2} className="w-full rounded-[12px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none" placeholder="e.g. Under investigation for a client complaint." />
          <div className="flex gap-2">
            <button type="button" disabled={busy} onClick={() => run(() => suspendProfessionalAction(userId, suspendReason))} className="min-h-[44px] rounded-full border border-warning px-6 py-2.5 text-sm font-semibold text-warning disabled:opacity-60">{busy ? "Suspending…" : "Confirm suspend"}</button>
            <button type="button" onClick={() => setAcctMode(null)} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted">Cancel</button>
          </div>
        </div>
      )}

      {acctMode === "ban" && (
        <div className="space-y-3">
          <p className="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2 text-[13px] text-danger">
            <strong>Destructive.</strong> Ban hides this pro everywhere (search, discovery, direct link), blocks pro features, deletes their ID, and prevents them from ever re-applying.
          </p>
          <label className="block text-sm font-semibold text-ink">Reason (required)</label>
          <textarea value={banReason} onChange={(e) => setBanReason(e.target.value)} rows={2} className="w-full rounded-[12px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none" placeholder="e.g. Fraudulent credentials." />
          <label className="block text-sm font-semibold text-ink">Type the business name to confirm: <span className="text-ink-muted">{businessName}</span></label>
          <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none" placeholder={businessName} />
          <div className="flex gap-2">
            <button
              type="button"
              disabled={busy || confirmName.trim() !== businessName.trim()}
              onClick={() => run(() => banProfessionalAction(userId, banReason))}
              className="min-h-[44px] rounded-full bg-danger px-6 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-40"
            >
              {busy ? "Banning…" : "Ban this account"}
            </button>
            <button type="button" onClick={() => { setAcctMode(null); setConfirmName(""); setBanReason(""); }} className="min-h-[44px] rounded-full border border-border px-5 py-2.5 text-sm font-semibold text-ink-muted">Cancel</button>
          </div>
        </div>
      )}
    </div>
  );
}

function InternalNote({ internal, setInternal, busy, onSave }: { internal: string; setInternal: (v: string) => void; busy: boolean; onSave: () => void }) {
  return (
    <div>
      <label className="block text-[12px] font-semibold uppercase tracking-wide text-ink-muted">Internal note (admins only)</label>
      <div className="mt-1.5 flex gap-2">
        <input value={internal} onChange={(e) => setInternal(e.target.value)} className="min-w-0 flex-1 rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-ink focus:border-rose focus:outline-none" placeholder="Private note for the team…" />
        <button type="button" disabled={busy || !internal.trim()} onClick={onSave} className="min-h-[40px] flex-none rounded-full border border-border px-4 text-sm font-semibold text-ink disabled:opacity-50">Add</button>
      </div>
    </div>
  );
}
