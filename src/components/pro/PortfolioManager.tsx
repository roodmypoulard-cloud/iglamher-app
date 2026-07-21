"use client";
import Image from "next/image";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deletePortfolioItemAction, setCoverPortfolioItemAction, uploadPortfolioImageAction } from "@/lib/pro/actions";
import { UPLOAD_LIMITS } from "@/lib/pro/schemas";
import type { PortfolioRow } from "@/lib/data/model";

export function PortfolioManager({ items }: { items: PortfolioRow[] }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const router = useRouter();

  function onSelect(file: File | undefined) {
    setUploadError(null);
    setMsg(null);
    if (!file) return;
    if (!UPLOAD_LIMITS.mimes.includes(file.type as (typeof UPLOAD_LIMITS.mimes)[number])) {
      setUploadError("Unsupported file type. Use JPEG, PNG, WebP, or AVIF.");
      return;
    }
    if (file.size > UPLOAD_LIMITS.maxBytes) {
      setUploadError(`That file is too large. Max ${UPLOAD_LIMITS.maxBytes / (1024 * 1024)} MB.`);
      return;
    }
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      const res = await uploadPortfolioImageAction(undefined, fd);
      if (res?.error) setUploadError(res.error);
      else {
        setMsg(res?.success ?? "Photo added.");
        router.refresh();
      }
    });
  }

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-rose px-4 py-2.5 text-sm font-semibold text-rose hover:bg-rose/10">
          {pending ? "Uploading…" : "Add photo"}
          <input
            type="file"
            accept={UPLOAD_LIMITS.mimes.join(",")}
            className="hidden"
            disabled={pending}
            onChange={(e) => onSelect(e.target.files?.[0])}
          />
        </label>
        {msg && <span className="text-[12px] text-ink-muted">{msg}</span>}
        {uploadError && <span className="text-[12px] text-danger">{uploadError}</span>}
      </div>

      {items.length === 0 ? (
        <p className="rounded-[12px] border border-border bg-surface px-4 py-8 text-center text-sm text-ink-muted">
          No portfolio items yet. Add photos of your best work.
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {items.map((item) => (
            <div key={item.id} className="relative overflow-hidden rounded-[14px] border border-border bg-bg-elevated">
              <div className="relative aspect-square">
                {item.url ? (
                  <Image src={item.url} alt={item.caption ?? "Portfolio item"} fill sizes="33vw" className="object-cover" />
                ) : (
                  <div className="grid h-full w-full place-items-center text-xs uppercase text-ink-muted">{item.kind}</div>
                )}
                {item.isCover && (
                  <span className="absolute left-2 top-2 rounded-full rose-gradient px-2 py-0.5 text-[10px] font-bold text-[#2A1712]">
                    Cover
                  </span>
                )}
                {item.isHidden && (
                  <span className="absolute right-2 top-2 rounded-full bg-danger/80 px-2 py-0.5 text-[10px] font-bold text-white">
                    Hidden
                  </span>
                )}
              </div>
              <div className="flex items-center justify-between px-3 py-2 text-[12px]">
                <button
                  type="button"
                  disabled={pending || item.isCover}
                  onClick={() => start(async () => setMsg((await setCoverPortfolioItemAction(item.id))?.success ?? null))}
                  className="font-semibold text-rose disabled:opacity-40"
                >
                  Set cover
                </button>
                <button
                  type="button"
                  disabled={pending}
                  onClick={() => {
                    if (!confirm("Delete this photo?")) return;
                    start(async () => setMsg((await deletePortfolioItemAction(item.id))?.success ?? null));
                  }}
                  className="font-semibold text-ink-muted hover:text-danger"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
