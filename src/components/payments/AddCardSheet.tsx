"use client";
import { useEffect, useMemo, useState, type FormEvent } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements, CardNumberElement, CardExpiryElement, CardCvcElement, useElements, useStripe,
} from "@stripe/react-stripe-js";
import type { StripeElementStyle } from "@stripe/stripe-js";
import { Sheet } from "@/components/ui/Modal";
import { createSetupIntentAction } from "@/lib/payments/payment-methods";

// Split Elements (number / expiry / CVC) instead of the one-line CardElement:
// larger labeled fields that read like a real checkout, still zero Stripe
// chrome (no Link banner, no wallet tabs). Styled to Soft Luxe via the element
// style API; our containers provide the bordered dark fields.
const elementStyle: StripeElementStyle = {
  base: {
    color: "#FFF8F4",
    fontFamily: "system-ui, -apple-system, sans-serif",
    fontSize: "16px",
    "::placeholder": { color: "#8d817b" },
    iconColor: "#D7A08F",
  },
  invalid: { color: "#D76E73", iconColor: "#D76E73" },
};

function haptic() {
  try {
    navigator.vibrate?.(10);
  } catch {
    /* unsupported */
  }
}

const field =
  "rounded-[14px] border border-border bg-bg px-4 py-[15px] transition-colors focus-within:border-rose focus-within:shadow-[0_0_0_3px_rgba(215,160,143,0.15)]";
const fieldLabel = "mb-1.5 block text-[11px] font-bold uppercase tracking-[0.12em] text-ink-muted";

/** Decorative rose-gold card art — makes the sheet read as "your wallet", not a form. */
function CardArt() {
  return (
    <div
      aria-hidden
      className="relative mx-auto h-[148px] w-full max-w-[300px] overflow-hidden rounded-[18px] shadow-[0_16px_40px_rgba(215,160,143,0.25)]"
      style={{ background: "linear-gradient(135deg, #9c6b4a 0%, #d7a08f 30%, #f6dfc8 52%, #d7a08f 72%, #8f5c3e 100%)" }}
    >
      <div className="absolute inset-0" style={{ background: "radial-gradient(120% 90% at 85% 0%, rgba(255,252,245,0.35), transparent 55%)" }} />
      {/* chip */}
      <div className="absolute left-5 top-5 h-8 w-10 rounded-[7px] border border-[#8f5c3e]/60 bg-gradient-to-br from-[#f8ecab] to-[#c69a34]">
        <div className="mx-auto mt-[9px] h-[1.5px] w-6 bg-[#8f5c3e]/50" />
        <div className="mx-auto mt-[4px] h-[1.5px] w-6 bg-[#8f5c3e]/50" />
      </div>
      {/* contactless */}
      <svg viewBox="0 0 24 24" width={20} height={20} fill="none" stroke="#2A1712" strokeWidth={1.8} strokeLinecap="round" className="absolute right-5 top-6 opacity-60">
        <path d="M6 8a8 8 0 0 1 0 8M10 6a11 11 0 0 1 0 12M14 4a14 14 0 0 1 0 16" />
      </svg>
      <p className="absolute bottom-11 left-5 font-mono text-[15px] font-semibold tracking-[0.18em] text-[#2A1712]/80">
        •••• &nbsp;•••• &nbsp;•••• &nbsp;••••
      </p>
      <p className="absolute bottom-4 left-5 text-[10px] font-bold uppercase tracking-[0.22em] text-[#2A1712]/60">iGlamHer Member</p>
      <p className="absolute bottom-4 right-5 font-display text-[13px] font-bold italic text-[#2A1712]/70">iGlamHer</p>
    </div>
  );
}

function BrandBadges() {
  const badge = "rounded-[6px] border border-border bg-surface px-2 py-1 text-[9.5px] font-extrabold tracking-wide text-ink-secondary";
  return (
    <div className="flex items-center justify-center gap-1.5" aria-label="Accepted cards">
      <span className={badge}>VISA</span>
      <span className={badge}>MASTERCARD</span>
      <span className={badge}>AMEX</span>
      <span className={badge}>DISCOVER</span>
    </div>
  );
}

function CardForm({ clientSecret, onDone }: { clientSecret: string; onDone: () => void }) {
  const stripe = useStripe();
  const elements = useElements();
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [zip, setZip] = useState("");

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!stripe || !elements || submitting) return;
    const number = elements.getElement(CardNumberElement);
    if (!number) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await stripe.confirmCardSetup(clientSecret, {
        payment_method: {
          card: number,
          billing_details: zip ? { address: { postal_code: zip } } : undefined,
        },
      });
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
      <div>
        <span className={fieldLabel}>Card number</span>
        <div className={field}>
          <CardNumberElement options={{ style: elementStyle, showIcon: true, disableLink: true }} onReady={() => setReady(true)} />
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <span className={fieldLabel}>Expiry</span>
          <div className={field}>
            <CardExpiryElement options={{ style: elementStyle }} />
          </div>
        </div>
        <div className="col-span-1">
          <span className={fieldLabel}>CVC</span>
          <div className={field}>
            <CardCvcElement options={{ style: elementStyle }} />
          </div>
        </div>
        <div className="col-span-1">
          <label className={fieldLabel} htmlFor="card-zip">ZIP</label>
          <input
            id="card-zip"
            inputMode="numeric"
            autoComplete="postal-code"
            placeholder="90001"
            value={zip}
            onChange={(e) => setZip(e.target.value.replace(/[^\d-]/g, "").slice(0, 10))}
            className={`${field} w-full text-[16px] text-ink placeholder:text-[#8d817b] focus:outline-none`}
          />
        </div>
      </div>

      {!ready && <p className="text-center text-[12px] text-ink-muted">Loading secure card fields…</p>}
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      <button
        type="submit"
        disabled={!stripe || !ready || submitting}
        aria-busy={submitting || undefined}
        className="min-h-[52px] w-full rounded-full rose-gradient py-4 text-[15px] font-bold text-[#2A1712] shadow-[0_10px_26px_rgba(215,160,143,0.35)] transition-transform duration-150 active:scale-[0.98] disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/70"
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

  if (!state) return <p className="py-10 text-center text-sm text-ink-muted">Loading secure form…</p>;
  if ("error" in state) return <p role="alert" className="py-4 text-sm text-danger">{state.error}</p>;
  if (!stripePromise) return null;
  return (
    <Elements stripe={stripePromise}>
      <CardForm clientSecret={state.clientSecret} onDone={onDone} />
    </Elements>
  );
}

/** Large premium sheet that collects + saves a card via a Stripe SetupIntent.
 *  Near-full-height on mobile; centered wide dialog feel on md+. */
export function AddCardSheet({ open, onClose, onAdded }: { open: boolean; onClose: () => void; onAdded: () => void }) {
  return (
    <Sheet open={open} onClose={onClose} title="Add a card" className="min-h-[78dvh] md:mx-auto md:min-h-0 md:w-full md:max-w-xl md:rounded-[24px] md:border md:p-7">
      <div className="space-y-5">
        <CardArt />
        <p className="text-center text-[13px] leading-relaxed text-ink-secondary">
          Save a card once — book and pay in one tap, every time.
        </p>
        <CardSetup
          onDone={() => {
            onAdded();
            onClose();
          }}
        />
        <BrandBadges />
        <p className="flex items-center justify-center gap-1.5 pb-1 text-[11.5px] text-ink-muted">
          <svg viewBox="0 0 24 24" width={13} height={13} fill="none" stroke="currentColor" strokeWidth={1.8} aria-hidden>
            <rect x="5" y="11" width="14" height="9" rx="2" />
            <path d="M8 11V8a4 4 0 0 1 8 0v3" />
          </svg>
          Secured by Stripe — your card details never touch our servers.
        </p>
      </div>
    </Sheet>
  );
}
