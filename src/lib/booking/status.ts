// Booking status machine. Single source of truth for legal transitions and who
// may perform them. Mirrors the booking_status enum in migration 0001.

export type BookingStatus =
  | "pending_payment"
  | "confirmed"
  | "change_requested"
  | "in_progress"
  | "completed"
  | "cancelled_customer"
  | "cancelled_professional"
  | "refunded"
  | "disputed"
  | "no_show";

export type Actor = "customer" | "professional" | "admin" | "system";

interface Transition {
  to: BookingStatus;
  by: Actor[];
}

// From -> allowed transitions.
const GRAPH: Record<BookingStatus, Transition[]> = {
  pending_payment: [
    { to: "confirmed", by: ["system"] }, // on successful payment webhook
    { to: "cancelled_customer", by: ["customer", "system"] },
    { to: "cancelled_professional", by: ["professional", "admin"] },
  ],
  confirmed: [
    { to: "change_requested", by: ["customer", "professional"] },
    { to: "in_progress", by: ["professional"] },
    { to: "cancelled_customer", by: ["customer"] },
    { to: "cancelled_professional", by: ["professional", "admin"] },
    { to: "no_show", by: ["professional"] },
    { to: "disputed", by: ["customer", "admin"] },
  ],
  change_requested: [
    { to: "confirmed", by: ["customer", "professional"] },
    { to: "cancelled_customer", by: ["customer"] },
    { to: "cancelled_professional", by: ["professional", "admin"] },
  ],
  in_progress: [
    { to: "completed", by: ["professional"] },
    { to: "disputed", by: ["customer", "admin"] },
  ],
  completed: [
    { to: "disputed", by: ["customer", "admin"] },
    { to: "refunded", by: ["admin"] },
  ],
  cancelled_customer: [{ to: "refunded", by: ["admin", "system"] }],
  cancelled_professional: [{ to: "refunded", by: ["admin", "system"] }],
  disputed: [
    { to: "refunded", by: ["admin"] },
    { to: "completed", by: ["admin"] },
  ],
  refunded: [],
  no_show: [{ to: "disputed", by: ["customer", "admin"] }],
};

/** Terminal states — a completed booking or a settled cancellation. */
export const TERMINAL: BookingStatus[] = ["refunded"];

export function allowedTransitions(from: BookingStatus): BookingStatus[] {
  return GRAPH[from].map((t) => t.to);
}

export function canTransition(from: BookingStatus, to: BookingStatus, by: Actor): boolean {
  return GRAPH[from].some((t) => t.to === to && t.by.includes(by));
}

/** Bookings that hold a time slot (block the calendar / exclusion constraint). */
export function reservesTime(status: BookingStatus): boolean {
  return ["pending_payment", "confirmed", "change_requested", "in_progress", "completed", "no_show"].includes(status);
}

export function isActive(status: BookingStatus): boolean {
  return ["pending_payment", "confirmed", "change_requested", "in_progress"].includes(status);
}

const LABELS: Record<BookingStatus, string> = {
  pending_payment: "Pending payment",
  confirmed: "Confirmed",
  change_requested: "Change requested",
  in_progress: "In progress",
  completed: "Completed",
  cancelled_customer: "Cancelled by you",
  cancelled_professional: "Cancelled by pro",
  refunded: "Refunded",
  disputed: "Disputed",
  no_show: "No-show",
};

export function statusLabel(status: BookingStatus): string {
  return LABELS[status];
}
