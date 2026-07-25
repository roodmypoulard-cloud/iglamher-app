"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { requestBookingChangeAction, respondBookingChangeAction } from "@/lib/booking/actions";
import type { BookingStatus } from "@/lib/booking/status";

type ProposedChange = { startsAt: string; endsAt: string; note: string | null; requestedByViewer: boolean };

function fmtWhen(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" })} · ${d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })}`;
}

/** `datetime-local` value (local tz) for an ISO timestamp — for input defaults. */
function toLocalInputValue(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/**
 * Reschedule flow on the booking detail page (both roles). The client only
 * proposes/responds — the server enforces party, status machine, and the
 * no-double-booking constraint when a new time is accepted.
 */
export function RescheduleActions({
  bookingId,
  status,
  viewerRole,
  startsAt,
  endsAt,
  proposedChange,
}: {
  bookingId: string;
  status: BookingStatus;
  viewerRole: "customer" | "professional";
  startsAt: string;
  endsAt: string;
  proposedChange: ProposedChange | null;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [newStart, setNewStart] = useState(() => toLocalInputValue(startsAt));
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Preserve the booked duration; fall back to an hour if ends_at is absent.
  const durationMs = (() => {
    const s = new Date(startsAt).getTime();
    const e = new Date(endsAt).getTime();
    return Number.isFinite(s) && Number.isFinite(e) && e > s ? e - s : 60 * 60_000;
  })();

  const submitRequest = () =>
    start(async () => {
      setError(null);
      const startDate = new Date(newStart);
      if (Number.isNaN(startDate.getTime())) {
        setError("Pick a valid new time.");
        return;
      }
      const res = await requestBookingChangeAction({
        bookingId,
        startUtc: startDate.toISOString(),
        endUtc: new Date(startDate.getTime() + durationMs).toISOString(),
        note: note.trim() || undefined,
      });
      if (!res.ok) setError(res.error);
      else {
        setOpen(false);
        router.refresh();
      }
    });

  const respond = (decision: "accept" | "decline") =>
    start(async () => {
      setError(null);
      const res = await respondBookingChangeAction(bookingId, decision);
      if (!res.ok) setError(res.error);
      else router.refresh();
    });

  if (status === "change_requested" && proposedChange) {
    const otherParty = viewerRole === "customer" ? "your provider" : "the customer";
    return (
      <section className="mt-4 rounded-[16px] border border-gold/40 bg-gold/10 p-4">
        <h2 className="font-display text-base font-bold text-ink">Time change requested</h2>
        <p className="mt-1 text-sm text-ink">
          Proposed new time: <span className="font-semibold">{fmtWhen(proposedChange.startsAt)}</span>
        </p>
        <p className="text-[12.5px] text-ink-muted">Current time: {fmtWhen(startsAt)}</p>
        {proposedChange.note && <p className="mt-2 text-[13px] italic text-ink-secondary">“{proposedChange.note}”</p>}
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        {proposedChange.requestedByViewer ? (
          <div className="mt-3">
            <p className="text-[13px] text-ink-muted">Waiting for {otherParty} to respond.</p>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("decline")}
              className="mt-2 min-h-[44px] w-full rounded-full border border-border text-sm font-semibold text-ink disabled:opacity-60 active:scale-[0.99]"
            >
              {pending ? "Withdrawing…" : "Withdraw request"}
            </button>
          </div>
        ) : (
          <div className="mt-3 flex gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("decline")}
              className="min-h-[44px] flex-1 rounded-full border border-border text-sm font-semibold text-ink disabled:opacity-60 active:scale-[0.99]"
            >
              Keep original time
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => respond("accept")}
              className="min-h-[44px] flex-1 rounded-full rose-gradient text-sm font-semibold text-[#2A1712] disabled:opacity-60 active:scale-[0.99]"
            >
              {pending ? "Updating…" : "Accept new time"}
            </button>
          </div>
        )}
      </section>
    );
  }

  if (status !== "confirmed") return null;

  return (
    <div className="mt-2">
      <button
        type="button"
        onClick={() => { setError(null); setOpen(true); }}
        className="min-h-[48px] w-full rounded-full border border-border text-sm font-semibold text-ink active:scale-[0.99]"
      >
        Request a time change
      </button>

      <Modal open={open} onClose={() => setOpen(false)} title="Propose a new time">
        <p className="text-sm text-ink-muted">
          Your booking keeps its current time until {viewerRole === "customer" ? "your provider" : "the customer"} accepts the new one.
        </p>
        <label htmlFor="reschedule-start" className="mt-4 block text-[13px] font-semibold text-ink">
          New date &amp; time
        </label>
        <input
          id="reschedule-start"
          type="datetime-local"
          value={newStart}
          min={toLocalInputValue(new Date().toISOString())}
          onChange={(e) => setNewStart(e.target.value)}
          className="mt-1 w-full rounded-[12px] border border-border bg-bg px-3 py-3 text-sm text-ink focus:border-rose focus:outline-none"
        />
        <label htmlFor="reschedule-note" className="mt-3 block text-[13px] font-semibold text-ink">
          Note <span className="font-normal text-ink-muted">(optional)</span>
        </label>
        <textarea
          id="reschedule-note"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          maxLength={400}
          rows={2}
          placeholder="Why the change?"
          className="mt-1 w-full resize-none rounded-[12px] border border-border bg-bg px-3 py-3 text-sm text-ink placeholder:text-ink-muted focus:border-rose focus:outline-none"
        />
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setOpen(false)} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink">
            Never mind
          </button>
          <button type="button" disabled={pending} onClick={submitRequest} className="flex-1 rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60">
            {pending ? "Sending…" : "Propose time"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
