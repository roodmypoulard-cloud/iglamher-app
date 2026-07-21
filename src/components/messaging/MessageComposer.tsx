"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendMessageAction } from "@/lib/messaging/actions";
import { ArrowRightIcon } from "@/components/ui/icons";
import { Spinner } from "@/components/ui/Spinner";

/**
 * Message input. Posts through the server action (which enforces the pre-booking
 * contact-info guard) and refreshes the thread. Optimistically clears on success.
 */
export function MessageComposer({ conversationId, locked }: { conversationId: string; locked: boolean }) {
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const router = useRouter();

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const body = value.trim();
    if (!body) return;
    setError(null);
    start(async () => {
      const res = await sendMessageAction({ conversationId, body });
      if (res.ok) {
        setValue("");
        router.refresh();
      } else {
        setError(res.error);
      }
    });
  }

  return (
    <div className="border-t border-border/60 bg-bg/85 px-4 py-3 backdrop-blur-md" style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 0.75rem)" }}>
      {locked && (
        <p className="mb-2 text-center text-[11px] text-ink-muted">
          Phone numbers &amp; emails are hidden until your booking is confirmed.
        </p>
      )}
      {error && <p className="mb-2 text-center text-[12px] text-rose">{error}</p>}
      <form onSubmit={submit} className="flex items-center gap-2">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Write a message…"
          aria-label="Message"
          maxLength={2000}
          className="min-w-0 flex-1 rounded-full border border-border bg-surface px-4 py-3 text-[15px] text-ink caret-rose placeholder:text-ink-muted focus:border-rose/70 focus:outline-none"
        />
        <button
          type="submit"
          disabled={pending || !value.trim()}
          aria-label="Send message"
          className="grid h-11 w-11 flex-none place-items-center rounded-full rose-gradient text-[#2A1712] shadow-[0_6px_16px_rgba(215,160,143,0.4)] transition-transform duration-150 ease-[cubic-bezier(0.34,1.56,0.64,1)] hover:brightness-105 active:scale-90 disabled:opacity-45"
        >
          {pending ? <Spinner size={16} /> : <ArrowRightIcon width={18} height={18} />}
        </button>
      </form>
    </div>
  );
}
