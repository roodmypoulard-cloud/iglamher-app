"use client";
import { useRef, useState, useTransition } from "react";
import { VerifiedIcon } from "@/components/ui/icons";
import { uploadIdDocumentAction, type IdVerificationState } from "@/lib/profile/id-verification";

/** Identity verification card for Settings: upload → pending → verified (gold
 *  check) / rejected (re-upload). PDF/JPG/PNG ≤ 10 MB, stored in the private
 *  verification-docs bucket and deleted once an admin gives a verdict. */
export function IdVerificationCard({ initial }: { initial: IdVerificationState | null }) {
  const [state, setState] = useState<IdVerificationState | null>(initial);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const fileRef = useRef<HTMLInputElement>(null);

  const status = state?.status ?? "unsubmitted";

  const onFile = (file: File | undefined) => {
    if (!file) return;
    const fd = new FormData();
    fd.set("file", file);
    start(async () => {
      setError(null);
      const res = await uploadIdDocumentAction(fd);
      if (res.ok) setState(res.state);
      else setError(res.error);
      if (fileRef.current) fileRef.current.value = "";
    });
  };

  return (
    <section className="overflow-hidden rounded-[18px] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-gold/15 text-gold">
          <VerifiedIcon width={16} height={16} />
        </span>
        <h2 className="font-display text-[15px] font-semibold text-ink">Identity verification</h2>
        {status === "approved" && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-gold/15 px-2.5 py-1 text-[11px] font-bold text-gold">
            <VerifiedIcon width={12} height={12} /> Verified
          </span>
        )}
        {status === "pending" && (
          <span className="ml-auto rounded-full bg-rose/10 px-2.5 py-1 text-[11px] font-bold text-rose">Under review</span>
        )}
        {status === "rejected" && (
          <span className="ml-auto rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-bold text-danger">Not approved</span>
        )}
      </div>

      <div className="px-4 py-3.5">
        {status === "approved" ? (
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            Your identity is verified — the gold checkmark now shows on your profile.
          </p>
        ) : status === "pending" ? (
          <p className="text-[13px] leading-relaxed text-ink-secondary">
            Your ID is with our team. Reviews usually finish within 1–2 days; you&apos;ll see the gold checkmark once approved.
          </p>
        ) : (
          <>
            <p className="text-[13px] leading-relaxed text-ink-secondary">
              {status === "rejected"
                ? "We couldn't verify that document. Upload a clearer photo of a government-issued ID to try again."
                : "Upload a government-issued ID to earn the gold verified checkmark. Pros feel safer booking verified clients."}
            </p>
            <input
              ref={fileRef}
              id="customer-id-file"
              type="file"
              accept="application/pdf,image/jpeg,image/png"
              className="sr-only"
              onChange={(e) => onFile(e.target.files?.[0])}
            />
            <label
              htmlFor="customer-id-file"
              aria-disabled={pending || undefined}
              className={`mt-3 inline-flex min-h-[40px] cursor-pointer items-center rounded-full rose-gradient px-4.5 py-2.5 text-[13px] font-bold text-[#2A1712] transition-transform active:scale-[0.98] ${pending ? "pointer-events-none opacity-60" : ""}`}
            >
              {pending ? "Uploading…" : status === "rejected" ? "Upload a new ID" : "Upload your ID"}
            </label>
            <p className="mt-2 text-[11.5px] text-ink-muted">
              PDF, JPG or PNG, up to 10 MB. Deleted after review — we never keep your ID on file.
            </p>
          </>
        )}
        {error && <p role="alert" className="mt-2 text-[12.5px] text-danger">{error}</p>}
      </div>
    </section>
  );
}
