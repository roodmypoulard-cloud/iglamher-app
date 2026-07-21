// Notification model + mock feed. Mirrors the `notifications` table shape so a
// real feed can drop in later. No push integration yet — this is in-app only.

export type NotificationKind = "booking" | "message" | "review" | "promo" | "system";

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  href?: string;
  createdAt: string; // UTC ISO
}

export const NOTIFICATION_META: Record<NotificationKind, { label: string; emoji: string; tone: string }> = {
  booking: { label: "Booking", emoji: "📅", tone: "text-rose" },
  message: { label: "Message", emoji: "💬", tone: "text-blush" },
  review: { label: "Review", emoji: "⭐", tone: "text-gold" },
  promo: { label: "Offer", emoji: "🎁", tone: "text-rose-light" },
  system: { label: "iGlamHer", emoji: "✨", tone: "text-ink-secondary" },
};

// ⚠️ DEV mock feed — replace with the `notifications` query once wired.
export const MOCK_NOTIFICATIONS: AppNotification[] = [
  {
    id: "n1",
    kind: "booking",
    title: "Appointment reminder",
    body: "Your Soft Glam with Maya R. is coming up. Tap to view details.",
    href: "/professionals/maya-rose-beauty",
    createdAt: "2026-07-18T15:30:00.000Z",
  },
  {
    id: "n2",
    kind: "message",
    title: "New message from Dee Styles",
    body: "“Hi! Confirming your knotless braids — see you Saturday 💕”",
    href: "/messages",
    createdAt: "2026-07-18T13:05:00.000Z",
  },
  {
    id: "n3",
    kind: "promo",
    title: "15% off your first booking",
    body: "Use code GLOWUP15 at checkout. Limited time.",
    href: "/discover",
    createdAt: "2026-07-17T18:00:00.000Z",
  },
  {
    id: "n4",
    kind: "review",
    title: "Leave a review",
    body: "How was your appointment with Nina K.? Share your experience.",
    href: "/professionals/nina-k-hair",
    createdAt: "2026-07-16T20:15:00.000Z",
  },
  {
    id: "n5",
    kind: "system",
    title: "Welcome to iGlamHer",
    body: "Discover trusted beauty pros near you and book in seconds.",
    href: "/discover",
    createdAt: "2026-07-15T09:00:00.000Z",
  },
];

export function timeAgo(iso: string, now: Date = new Date()): string {
  const diff = now.getTime() - new Date(iso).getTime();
  const m = Math.round(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  return d === 1 ? "yesterday" : `${d}d ago`;
}
