"use client";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Modal";

const STEPS = [
  { n: 1, title: "Search for a service", desc: "Hair, makeup, lashes, nails or styling — find what you need." },
  { n: 2, title: "Choose a professional", desc: "Compare verified pros, portfolios and real reviews." },
  { n: 3, title: "Select a date & time", desc: "Pick a slot that fits your schedule." },
  { n: 4, title: "Pay securely", desc: "Protected checkout — a small deposit reserves your spot." },
  { n: 5, title: "Receive the service", desc: "Enjoy your glam, then tip and leave a review." },
];

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
}

/** Polished bottom sheet explaining the booking flow, with a primary CTA into Discover. */
export function EasyBookingSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const router = useRouter();
  return (
    <Sheet open={open} onClose={onClose} title="How booking works">
      <ol className="space-y-3.5">
        {STEPS.map((s) => (
          <li key={s.n} className="flex gap-3.5">
            <span className="grid h-8 w-8 flex-none place-items-center rounded-full rose-gradient text-sm font-bold text-[#2A1712]" aria-hidden>
              {s.n}
            </span>
            <div className="min-w-0">
              <p className="font-semibold text-ink">{s.title}</p>
              <p className="text-sm text-ink-secondary">{s.desc}</p>
            </div>
          </li>
        ))}
      </ol>
      <button
        type="button"
        onClick={() => {
          haptic();
          onClose();
          // Real booking entry: pick a category → pros in it (recommended first) → book.
          router.push("/categories");
        }}
        className="mt-6 min-h-[44px] w-full rounded-full rose-gradient py-3.5 text-sm font-semibold text-[#2A1712] transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
      >
        Start Booking
      </button>
    </Sheet>
  );
}
