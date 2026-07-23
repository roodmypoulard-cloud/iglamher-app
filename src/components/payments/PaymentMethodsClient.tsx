"use client";
import { useEffect, useState, useTransition } from "react";
import { AddCardSheet } from "./AddCardSheet";
import { CreditCardIcon } from "@/components/ui/icons";
import { listMyCardsAction, setDefaultCardAction, removeCardAction, type SavedCard } from "@/lib/payments/payment-methods";

const BRAND_LABEL: Record<string, string> = {
  visa: "Visa",
  mastercard: "Mastercard",
  amex: "American Express",
  discover: "Discover",
  diners: "Diners Club",
  jcb: "JCB",
  unionpay: "UnionPay",
};

function brandLabel(brand: string): string {
  return BRAND_LABEL[brand] ?? brand.charAt(0).toUpperCase() + brand.slice(1);
}

export function PaymentMethodsClient({ initialCards = [] }: { initialCards?: SavedCard[] }) {
  const [cards, setCards] = useState<SavedCard[]>(initialCards);
  const [addOpen, setAddOpen] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  async function refresh() {
    const r = await listMyCardsAction();
    if ("cards" in r) setCards(r.cards);
  }

  // Load the latest cards on mount — lets this component work embedded (Settings)
  // without server-provided initial data, and keeps the dedicated page fresh.
  useEffect(() => {
    let alive = true;
    listMyCardsAction().then((r) => {
      if (alive && "cards" in r) setCards(r.cards);
    });
    return () => {
      alive = false;
    };
  }, []);

  function makeDefault(id: string) {
    setError(null);
    setBusyId(id);
    startTransition(async () => {
      const r = await setDefaultCardAction(id);
      if (!r.ok && r.error) setError(r.error);
      await refresh();
      setBusyId(null);
    });
  }

  function remove(id: string) {
    setError(null);
    setBusyId(id);
    setConfirmRemove(null);
    startTransition(async () => {
      const r = await removeCardAction(id);
      if (!r.ok && r.error) setError(r.error);
      await refresh();
      setBusyId(null);
    });
  }

  return (
    <div className="space-y-4">
      {error && <p role="alert" className="text-sm text-danger">{error}</p>}

      {cards.length === 0 ? (
        <div className="rounded-[16px] border border-border bg-surface p-6 text-center">
          <CreditCardIcon width={30} height={30} className="mx-auto mb-3 text-ink-muted" />
          <p className="font-semibold text-ink">No cards saved yet</p>
          <p className="mt-1 text-sm text-ink-secondary">Add a credit or debit card to book faster and cover your balance automatically.</p>
        </div>
      ) : (
        <ul className="space-y-2.5">
          {cards.map((c) => (
            <li key={c.id} className="rounded-[16px] border border-border bg-surface p-4">
              <div className="flex items-center gap-3">
                <span className="grid h-10 w-14 flex-none place-items-center rounded-[8px] border border-border bg-bg text-[11px] font-bold uppercase tracking-wide text-ink-secondary">
                  {brandLabel(c.brand).slice(0, 4)}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="font-semibold text-ink">
                    {brandLabel(c.brand)} <span className="text-ink-muted">•••• {c.last4}</span>
                  </p>
                  <p className="text-[12px] text-ink-muted">
                    Expires {String(c.expMonth).padStart(2, "0")}/{String(c.expYear).slice(-2)}
                  </p>
                </div>
                {c.isDefault && (
                  <span className="flex-none rounded-full bg-success/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-success">
                    Default
                  </span>
                )}
              </div>
              <div className="mt-3 flex items-center gap-4 border-t border-border/60 pt-3">
                {!c.isDefault && (
                  <button
                    type="button"
                    onClick={() => makeDefault(c.id)}
                    disabled={busyId === c.id}
                    className="min-h-[44px] text-sm font-semibold text-rose disabled:opacity-50"
                  >
                    {busyId === c.id ? "Saving…" : "Make default"}
                  </button>
                )}
                {confirmRemove === c.id ? (
                  <span className="ml-auto flex items-center gap-3 text-sm">
                    <span className="text-ink-muted">Remove?</span>
                    <button type="button" onClick={() => remove(c.id)} className="min-h-[44px] font-semibold text-danger">
                      Yes
                    </button>
                    <button type="button" onClick={() => setConfirmRemove(null)} className="min-h-[44px] font-semibold text-ink-muted">
                      Cancel
                    </button>
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => setConfirmRemove(c.id)}
                    disabled={busyId === c.id}
                    className="ml-auto min-h-[44px] text-sm font-semibold text-ink-muted hover:text-danger disabled:opacity-50"
                  >
                    Remove
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={() => {
          try {
            navigator.vibrate?.(10);
          } catch {
            /* unsupported */
          }
          setAddOpen(true);
        }}
        className="flex min-h-[52px] w-full items-center justify-center gap-2 rounded-full border border-rose/50 bg-rose/[0.06] py-3.5 text-sm font-semibold text-rose transition-transform duration-150 active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose/60"
      >
        <span className="text-lg leading-none">＋</span> Add a card
      </button>

      <AddCardSheet open={addOpen} onClose={() => setAddOpen(false)} onAdded={refresh} />
    </div>
  );
}
