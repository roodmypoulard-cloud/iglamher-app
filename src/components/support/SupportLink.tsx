"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

const SUPPORT_EMAIL = "support@iglamher.com";
const APP_VERSION = "Beta 1.0";

/** Compose the mailto with a prefilled subject + diagnostic footer (platform,
 *  app version, current page) so support gets context without asking. */
function buildMailto(): string {
  const subject = "iGlamHer Support Request";
  const ua = typeof navigator !== "undefined" ? navigator.userAgent : "";
  const platform = /iPhone|iPad|iPod/.test(ua) ? "iOS" : /Android/.test(ua) ? "Android" : "Web";
  const page = typeof location !== "undefined" ? location.pathname : "";
  const body = [
    "Hi iGlamHer team,",
    "",
    "", // user writes here
    "",
    "—".repeat(12),
    `App version: ${APP_VERSION}`,
    `Platform: ${platform}`,
    page ? `Screen: ${page}` : "",
  ].filter((l) => l !== "").join("\n");
  return `mailto:${SUPPORT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}

/**
 * Support entry that opens the native email composer prefilled. If no mail
 * client takes over (common on desktop browsers without a handler), a small
 * fallback sheet appears with the address and a copy button — the user is
 * never forced to copy by hand, and never dead-ends.
 */
export function SupportLink({ children, className }: { children: ReactNode; className?: string }) {
  const [fallback, setFallback] = useState(false);
  const [copied, setCopied] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  const onClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    const before = Date.now();
    window.location.href = buildMailto();
    // If a mail app takes over, the tab blurs/hides almost immediately. If we're
    // still visible after a beat, assume no handler and offer the fallback.
    timerRef.current = setTimeout(() => {
      if (document.visibilityState === "visible" && Date.now() - before >= 1200) setFallback(true);
    }, 1400);
  }, []);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(SUPPORT_EMAIL);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard unavailable — the address is selectable text right here.
    }
  }, []);

  return (
    <>
      <a href={`mailto:${SUPPORT_EMAIL}`} onClick={onClick} className={className}>
        {children}
      </a>

      {fallback && (
        <div role="dialog" aria-label="Contact support" className="fixed inset-0 z-50 flex items-end justify-center bg-black/50 p-4 md:items-center" onClick={() => setFallback(false)}>
          <div className="w-full max-w-sm rounded-[20px] border border-border bg-bg-elevated p-5 shadow-luxe" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display text-lg font-bold">Email us</h2>
            <p className="mt-1 text-[13px] leading-relaxed text-ink-secondary">
              We couldn&apos;t open your email app. Reach us any time at:
            </p>
            <p className="mt-3 select-all rounded-[12px] border border-border bg-surface px-3.5 py-2.5 text-center text-[14px] font-semibold text-rose">
              {SUPPORT_EMAIL}
            </p>
            <div className="mt-3 flex gap-2">
              <button type="button" onClick={copy} className="flex-1 rounded-full rose-gradient py-2.5 text-[13px] font-bold text-[#2A1712]">
                {copied ? "Copied ✓" : "Copy address"}
              </button>
              <button type="button" onClick={() => setFallback(false)} className="flex-1 rounded-full border border-border py-2.5 text-[13px] font-semibold text-ink-secondary">
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
