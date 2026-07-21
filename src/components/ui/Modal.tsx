"use client";
import { useEffect, useRef, type ReactNode } from "react";
import { cn } from "@/lib/format";

function useDismiss(open: boolean, onClose: () => void) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);
}

/** Centered modal on desktop; use Sheet for mobile-first flows. */
export function Modal({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  useDismiss(open, onClose);
  useEffect(() => {
    if (open) ref.current?.focus();
  }, [open]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        className="slide-up w-full max-w-md rounded-[20px] border border-border bg-bg-elevated p-6 outline-none"
      >
        {title && <h2 className="mb-3 font-display text-xl font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}

/** Bottom sheet — the mobile-first modal per the responsive spec. */
export function Sheet({
  open,
  onClose,
  title,
  children,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  className?: string;
}) {
  useDismiss(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end bg-black/60" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onClick={(e) => e.stopPropagation()}
        style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1.25rem)" }}
        className={cn("slide-up max-h-[85vh] overflow-y-auto rounded-t-[24px] border-t border-border bg-bg-elevated p-5", className)}
      >
        <div className="mx-auto mb-4 h-1 w-10 rounded-full bg-border" aria-hidden />
        {title && (
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-xl font-semibold">{title}</h2>
            <button type="button" onClick={onClose} className="text-sm font-semibold text-rose">
              Done
            </button>
          </div>
        )}
        {children}
      </div>
    </div>
  );
}
