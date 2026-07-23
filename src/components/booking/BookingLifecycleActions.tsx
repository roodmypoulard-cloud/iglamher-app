"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { updateBookingStatusAction } from "@/lib/booking/actions";
import type { BookingStatus } from "@/lib/booking/status";

/**
 * Start / Finish service actions. The client only *requests* a transition — the
 * server (updateBookingStatusAction) enforces role, current status, ownership,
 * the balance hold (on start) and capture + payout (on finish). Confirmation
 * step before each; buttons disable during the request; no duplicate submits.
 */
export function BookingLifecycleActions({
  bookingId,
  status,
  viewerRole,
}: {
  bookingId: string;
  status: BookingStatus;
  viewerRole: "customer" | "professional";
}) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | "start" | "finish" | "cancel">(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  // Customers cancel their own booking; a pro cancelling is a "reject" (records
  // cancelled_professional and fully refunds the customer, server-side).
  const cancelAction = viewerRole === "professional" ? "reject" : "cancel";

  const run = (action: "start" | "complete" | "cancel" | "reject") =>
    start(async () => {
      setError(null);
      const res = await updateBookingStatusAction(bookingId, action);
      if (!res.ok) setError(res.error);
      else {
        setDialog(null);
        router.refresh();
      }
    });

  const cancelDialog = (
    <Modal open={dialog === "cancel"} onClose={() => setDialog(null)} title="Cancel this booking?">
      <p className="text-sm text-ink-muted">
        {viewerRole === "professional"
          ? "This cancels the appointment and fully refunds the client's deposit. Let them know if you can."
          : "This cancels your appointment. Your deposit is refunded per the cancellation policy — cancellations closer to the start time may be partially non-refundable."}
      </p>
      {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={() => setDialog(null)} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink">Keep booking</button>
        <button type="button" disabled={pending} onClick={() => run(cancelAction)} className="flex-1 rounded-full border border-danger py-3 text-sm font-semibold text-danger disabled:opacity-60">
          {pending ? "Cancelling…" : "Cancel booking"}
        </button>
      </div>
    </Modal>
  );

  // Customer-facing status cues.
  if (viewerRole === "customer") {
    if (status === "in_progress") {
      return (
        <div className="mt-4 rounded-[14px] border border-rose/30 bg-rose/10 px-4 py-3 text-sm font-semibold text-rose">
          Your service is in progress.
        </div>
      );
    }
    if (status === "confirmed") {
      return (
        <div className="mt-6">
          <button
            type="button"
            onClick={() => { setError(null); setDialog("cancel"); }}
            className="min-h-[48px] w-full rounded-full border border-border text-sm font-semibold text-ink active:scale-[0.99]"
          >
            Cancel booking
          </button>
          {cancelDialog}
        </div>
      );
    }
    return null;
  }

  // Professional actions.
  return (
    <div className="mt-6">
      {status === "confirmed" && (
        <button
          type="button"
          onClick={() => { setError(null); setDialog("start"); }}
          className="min-h-[48px] w-full rounded-full rose-gradient text-sm font-semibold text-[#2A1712] active:scale-[0.99]"
        >
          Start service
        </button>
      )}
      {status === "confirmed" && (
        <button
          type="button"
          onClick={() => { setError(null); setDialog("cancel"); }}
          className="mt-2 min-h-[48px] w-full rounded-full border border-border text-sm font-semibold text-ink active:scale-[0.99]"
        >
          Cancel booking
        </button>
      )}
      {status === "in_progress" && (
        <button
          type="button"
          onClick={() => { setError(null); setDialog("finish"); }}
          className="min-h-[48px] w-full rounded-full rose-gradient text-sm font-semibold text-[#2A1712] active:scale-[0.99]"
        >
          Finish service
        </button>
      )}

      {cancelDialog}

      <Modal open={dialog === "start"} onClose={() => setDialog(null)} title="Start this service?">
        <p className="text-sm text-ink-muted">
          This marks the appointment as in progress and places a hold on the client&apos;s card for the remaining balance. Only start when you&apos;re with the client.
        </p>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setDialog(null)} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink">Cancel</button>
          <button type="button" disabled={pending} onClick={() => run("start")} className="flex-1 rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60">
            {pending ? "Starting…" : "Start service"}
          </button>
        </div>
      </Modal>

      <Modal open={dialog === "finish"} onClose={() => setDialog(null)} title="Finish this service?">
        <p className="text-sm text-ink-muted">
          This completes the booking, charges the held balance, and releases your payout. The client can then tip and review. This can&apos;t be undone.
        </p>
        {error && <p role="alert" className="mt-2 text-sm text-danger">{error}</p>}
        <div className="mt-4 flex gap-2">
          <button type="button" onClick={() => setDialog(null)} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink">Cancel</button>
          <button type="button" disabled={pending} onClick={() => run("complete")} className="flex-1 rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60">
            {pending ? "Finishing…" : "Finish service"}
          </button>
        </div>
      </Modal>
    </div>
  );
}
