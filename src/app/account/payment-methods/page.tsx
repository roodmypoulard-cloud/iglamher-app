import { Shell, SectionHeader } from "@/components/marketplace/Shell";
import { BackButton } from "@/components/ui/BackButton";
import { PaymentMethodsClient } from "@/components/payments/PaymentMethodsClient";
import { listMyCardsAction } from "@/lib/payments/payment-methods";

export const dynamic = "force-dynamic";
export const metadata = { title: "Payment methods · iGlamHer" };

export default async function PaymentMethodsPage() {
  const res = await listMyCardsAction();
  const cards = "cards" in res ? res.cards : [];

  return (
    <Shell>
      <div className="mb-4">
        <BackButton fallback="/account" label="Account" />
      </div>
      <SectionHeader title="Payment methods" />
      <p className="mb-5 text-sm text-ink-muted">
        Add a credit or debit card. Cards are stored securely by Stripe and used to reserve your balance and pay for services.
      </p>
      <PaymentMethodsClient initialCards={cards} />
    </Shell>
  );
}
