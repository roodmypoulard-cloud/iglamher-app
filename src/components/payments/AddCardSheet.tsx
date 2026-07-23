"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import { Elements, CardElement, useElements, useStripe } from "@stripe/react-stripe-js";
import type { StripeCardElementOptions } from "@stripe/stripe-js";
import { Sheet } from "@/components/ui/Modal";
import { createSetupIntentAction } from "@/lib/payments/payment-methods";

// CardElement (not PaymentElement): bare number/expiry/CVC fields with ZERO
// Stripe chrome — no Link banner, no wallet tabs, no floating brand badge to
// get stuck on screen. Styled to Soft Luxe via the element's own style API;
// the input container below provides the bordered dark field.
const cardOptions: StripeCardElementOptions = {
  hidePostalCode: false,
  disableLink: true,
  style: {
    base: {
      color: "#FFF8F4",
      fontFamily: "system-ui, -apple-system, sans-serif",
      fontSize: "15px",
      "::placeholder": { color: "#8d817b" },
      iconColor: "#D7A08F",
    },
    invalid: { color: "#D76E73", iconColor: "#D76E73" },
  },
};

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
}

function CardForm({ clientSecret, onDone }: { clientSecret: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    const card = elements.getElement(CardElement);
    if (!card) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmCardSetup(clientSecret, { payment_method: { card } });
      if (result.error) {
        setError(result.error.message ?? "We couldn't save that card. Please try again.");
      } else {
        haptic();
        onDone();
      }
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="rounded-[12px] border border-border bg-bg px-3.5 py-3.5 focus-within:border-rose">
        <CardElement options={cardOptions} onReady={() => setReady(true)} />
      </div>
      {!ready && <p className="text-center text-[12px] text-ink-muted">Loading secure card fields…</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}
      <button
        type="submit"
        disabled={!stripe || !ready || submitting}
        aria-busy={submitting || undefined}
        className="min-h-[44px] w-full rounded-full rose-gradient py-3.5 text-sm font-semibold text-[#2A1712] transition-transform duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
      >
        {submitting ? "Saving…" : "Save card"}
      </button>
    </form>
  );
}

/** Fetches a fresh SetupIntent on mount and renders the card fields. Mounts only
 *  while the sheet is open (Sheet unmounts children when closed), so each open
 *  gets a new SetupIntent and closing unmounts Elements — which destroys the
 *  Stripe iframes, so nothing (logo, badge, overlay) can outlive the sheet. */
function CardSetup({ onDone }: { onDone: () => void }) {
  const [state, setState] = useState<{ clientSecret: string; publishableKey: string } | { error: string } | null>(null);

  useEffect(() => {
    let alive = true;
    createSetupIntentAction().then((r) => {
      if (alive) setState(r);
    });
    return () => {
      alive = false;
    };
  }, []);

  const pk = state && "publishableKey" in state ? state.publishableKey : null;
  const stripePromise = useMemo(() => (pk ? loadStripe(pk) : null), [pk]);

  if (!state) return <p className="py-8 text-center text-sm text-ink-muted">Loading secure form…</p>;
  if ("error" in state) return <p role="alert" className="py-4 text-sm text-danger">{state.error}</p>;
  if (!stripePromise) return null;
  return (
    <Elements stripe={stripePromise}>
      <CardForm clientSecret={state.clientSecret} onDone={onDone} />
    </Elements>
  );
}

/** Bottom sheet that collects + saves a card via a Stripe SetupIntent. */
export function AddCardSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a card">
      <CardSetup
        onDone={() => {
          onAdded();
          onClose();
        }}
      />
      <p className="mt-3 flex items-center justify-center gap-1.5 text-[11px] text-ink-muted">
        <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
          <rect x="5" y="11" width="14" height="9" rx="2" />
          <path d="M8 11V8a4 4 0 0 1 8 0v3" />
        </svg>
        Secured by Stripe — your card details never touch our servers.
      </p>
    </Sheet>
  );
}
