"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadDocumentAction, removeDocumentAction } from "@/lib/pro/application-actions";
import { DOC_MIME_TYPES, DOC_MAX_BYTES } from "@/lib/pro/application";

type Kind = "certification" | "license" | "id_document";

export function DocumentUploader({
  kind, title, documents, disabled = false,
}: {
  kind: Kind;
  title: string;
  documents: { id: string; kind: string; fileName: string }[];
  disabled?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, start] = useTransition();
  const mine = documents.filter((d) => d.kind === kind);

  function onPick(file: File | undefined) {
    if (!file) return;
    setError(null);
    if (!(DOC_MIME_TYPES as readonly string[]).includes(file.type)) { setError("Only PDF, JPG, JPEG, or PNG."); return; }
    if (file.size > DOC_MAX_BYTES) { setError("File too large (max 10 MB)."); return; }
    const fd = new FormData();
    fd.set("kind", kind);
    fd.set("file", file);
    start(async () => {
      const r = await uploadDocumentAction(fd);
      if (r.ok) router.refresh();
      else setError(r.error);
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  function remove(id: string) {
    start(async () => {
      const r = await removeDocumentAction(id);
      if (r.ok) router.refresh();
      else setError(r.error);
    });
  }

  return (
    <div className="rounded-[12px] border border-border bg-bg-elevated p-4">
      <p className="mb-2 text-sm font-semibold text-ink">{title}</p>
      {mine.length > 0 && (
        <ul className="mb-3 space-y-1.5">
          {mine.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-3 rounded-[8px] bg-bg px-3 py-2 text-sm">
              <span className="min-w-0 truncate text-ink-secondary">{d.fileName}</span>
              {!disabled && <button type="button" onClick={() => remove(d.id)} disabled={busy} className="flex-none text-[12px] font-semibold text-danger disabled:opacity-50">Remove</button>}
            </li>
          ))}
        </ul>
      )}
      {error && <p role="alert" className="mb-2 text-[13px] text-danger">{error}</p>}
      {!disabled && (
        <>
          <input ref={inputRef} type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" className="hidden" onChange={(e) => onPick(e.target.files?.[0])} />
          <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="min-h-[44px] w-full rounded-full border border-rose/40 bg-rose/[0.06] text-sm font-semibold text-rose disabled:opacity-60">
            {busy ? "Uploading…" : `+ Upload ${title.toLowerCase()}`}
          </button>
        </>
      )}
    </div>
  );
}
