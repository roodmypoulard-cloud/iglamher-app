"use client";
import { useState, useTransition } from "react";
import Image from "next/image";
import { Modal } from "@/components/ui/Modal";
import { reviewDocumentAction } from "@/lib/admin/verification-actions";
import type { AppDocument } from "@/lib/admin/verification-data";

const DOC_LABELS: Record<string, string> = {
  id_document: "Government ID",
  certification: "Certification",
  license: "License",
  diploma: "Diploma",
  certificate: "Certificate",
  insurance: "Insurance",
  portfolio_photo: "Portfolio photo",
  other: "Other document",
};

export function PortfolioGallery({ items }: { items: { id: string; url: string | null; caption: string | null }[] }) {
  const [open, setOpen] = useState<number | null>(null);
  const withUrls = items.filter((i) => i.url);
  if (withUrls.length === 0) return <p className="text-sm text-ink-muted">No portfolio photos uploaded.</p>;
  return (
    <>
      <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
        {withUrls.map((item, i) => (
          <button key={item.id} type="button" onClick={() => setOpen(i)} className="relative aspect-square overflow-hidden rounded-[12px] border border-border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/60">
            <Image src={item.url as string} alt={item.caption ?? "Portfolio image"} fill sizes="(max-width:640px) 33vw, 160px" className="object-cover transition-transform hover:scale-105" />
          </button>
        ))}
      </div>
      {open !== null && (
        <Modal open onClose={() => setOpen(null)} title="Portfolio">
          <div className="relative">
            <Image src={withUrls[open].url as string} alt={withUrls[open].caption ?? "Portfolio image"} width={900} height={900} className="h-auto max-h-[70vh] w-full rounded-[12px] object-contain" />
            {withUrls[open].caption && <p className="mt-2 text-center text-sm text-ink-secondary">{withUrls[open].caption}</p>}
            <div className="mt-3 flex items-center justify-between">
              <button type="button" onClick={() => setOpen((o) => (o! > 0 ? o! - 1 : withUrls.length - 1))} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">← Prev</button>
              <span className="text-xs text-ink-muted">{open + 1} / {withUrls.length}</span>
              <button type="button" onClick={() => setOpen((o) => (o! < withUrls.length - 1 ? o! + 1 : 0))} className="rounded-full border border-border px-4 py-2 text-sm font-semibold">Next →</button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}

function DocStatusBadge({ status }: { status: string }) {
  if (status === "verified") return <span className="rounded-full bg-success/15 px-2.5 py-0.5 text-[11px] font-semibold text-success">✓ Verified</span>;
  if (status === "flagged") return <span className="rounded-full bg-danger/15 px-2.5 py-0.5 text-[11px] font-semibold text-danger">✗ Flagged</span>;
  return <span className="rounded-full bg-border/40 px-2.5 py-0.5 text-[11px] font-semibold text-ink-muted">Pending</span>;
}

/** Per-document review row: preview + Verify / Flag (flag requires a reason). `readOnly`
 *  turns off the controls once the application reaches a terminal decision. */
function DocumentRow({ doc, readOnly, onPreview }: { doc: AppDocument; readOnly: boolean; onPreview: () => void }) {
  const [pending, start] = useTransition();
  const [flagging, setFlagging] = useState(false);
  const [reason, setReason] = useState("");
  const [err, setErr] = useState<string | null>(null);

  function verify() {
    setErr(null);
    start(async () => {
      const r = await reviewDocumentAction(doc.id, "verified");
      if (!r.ok) setErr(r.error);
    });
  }
  function submitFlag() {
    setErr(null);
    start(async () => {
      const r = await reviewDocumentAction(doc.id, "flagged", reason);
      if (!r.ok) setErr(r.error);
      else { setFlagging(false); setReason(""); }
    });
  }

  return (
    <li className="rounded-[12px] border border-border bg-bg-elevated px-4 py-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-sm font-semibold text-ink">
            <span className="truncate">{DOC_LABELS[doc.kind] ?? doc.kind}</span>
            <DocStatusBadge status={doc.reviewStatus} />
          </p>
          <p className="truncate text-[12px] text-ink-muted">{doc.fileName}</p>
          {doc.reviewStatus === "flagged" && doc.flagReason && <p className="mt-1 text-[12px] text-danger">Flagged: {doc.flagReason}</p>}
        </div>
        <div className="flex flex-none gap-2">
          <button type="button" onClick={onPreview} disabled={!doc.signedUrl} className="rounded-full border border-rose/40 px-3 py-2 text-sm font-semibold text-rose disabled:opacity-50">Preview</button>
        </div>
      </div>
      {!readOnly && (
        <div className="mt-3 border-t border-border/60 pt-3">
          {flagging ? (
            <div className="space-y-2">
              <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={2} placeholder="Why is this document being flagged? (the applicant will see this)"
                className="w-full rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-ink placeholder:text-ink-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/50" />
              <div className="flex gap-2">
                <button type="button" onClick={submitFlag} disabled={pending} className="rounded-full bg-danger px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Saving…" : "Confirm flag"}</button>
                <button type="button" onClick={() => { setFlagging(false); setReason(""); setErr(null); }} className="rounded-full border border-border px-4 py-1.5 text-sm font-semibold text-ink-muted">Cancel</button>
              </div>
            </div>
          ) : (
            <div className="flex gap-2">
              <button type="button" onClick={verify} disabled={pending || doc.reviewStatus === "verified"} className="rounded-full border border-success/50 px-4 py-1.5 text-sm font-semibold text-success disabled:opacity-40">✓ Verify</button>
              <button type="button" onClick={() => setFlagging(true)} disabled={pending} className="rounded-full border border-danger/50 px-4 py-1.5 text-sm font-semibold text-danger disabled:opacity-60">✗ Flag</button>
            </div>
          )}
          {err && <p className="mt-2 text-[12px] text-danger">{err}</p>}
        </div>
      )}
    </li>
  );
}

export function DocumentViewer({ documents, readOnly = false }: { documents: AppDocument[]; readOnly?: boolean }) {
  const [preview, setPreview] = useState<AppDocument | null>(null);
  if (documents.length === 0) {
    return (
      <p className="flex items-center gap-2 rounded-[12px] border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning">
        ⚠ No documents uploaded (certifications/ID missing). Approval is blocked until required documents are verified.
      </p>
    );
  }
  return (
    <>
      <ul className="space-y-2">
        {documents.map((d) => (
          <DocumentRow key={d.id} doc={d} readOnly={readOnly} onPreview={() => setPreview(d)} />
        ))}
      </ul>
      {preview && preview.signedUrl && (
        <Modal open onClose={() => setPreview(null)} title={DOC_LABELS[preview.kind] ?? "Document"}>
          {preview.mimeType.startsWith("image/") ? (
            <Image src={preview.signedUrl} alt={preview.fileName} width={900} height={900} className="h-auto max-h-[72vh] w-full rounded-[12px] object-contain" unoptimized />
          ) : (
            <object data={preview.signedUrl} type="application/pdf" className="h-[72vh] w-full rounded-[12px]">
              <p className="p-4 text-sm text-ink-muted">Can&apos;t preview inline — <a className="text-rose underline" href={preview.signedUrl} target="_blank" rel="noopener noreferrer">open in a new tab</a>.</p>
            </object>
          )}
          <p className="mt-2 text-center text-[11px] text-ink-muted">Secure preview link — expires in ~90 seconds.</p>
        </Modal>
      )}
    </>
  );
}
