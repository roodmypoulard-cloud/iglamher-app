import { LegalLayout, H2 } from "@/components/legal/LegalLayout";

export const metadata = { title: "Cancellation Policy · iGlamHer" };

export default function CancellationPage() {
  return (
    <LegalLayout title="Cancellation Policy" updated="July 2026">
      <p>
        We want fair outcomes for both customers and professionals. Cancellation terms depend on how much notice you
        give before your appointment. Individual professionals may set stricter policies, shown before you book.
      </p>
      <H2>Standard windows</H2>
      <ul className="list-disc space-y-2 pl-5">
        <li><strong className="text-ink">48+ hours before:</strong> free cancellation — your deposit is fully refunded.</li>
        <li><strong className="text-ink">24–48 hours before:</strong> 50% of the deposit is retained.</li>
        <li><strong className="text-ink">Under 24 hours / no-show:</strong> the deposit is non-refundable.</li>
      </ul>
      <H2>Professional cancellations</H2>
      <p>
        If a professional cancels, you receive a full refund. Repeated professional cancellations lower their search
        ranking and may trigger review.
      </p>
      <H2>Disputes</H2>
      <p>
        If something goes wrong, open a dispute in the app within 72 hours. You can upload photos and details; our team
        reviews evidence and can issue full or partial refunds under our protection policies.
      </p>
      <H2>Reliability</H2>
      <p>
        Frequent late cancellations or no-shows affect your reliability score, which helps professionals and keeps the
        marketplace dependable for everyone.
      </p>
    </LegalLayout>
  );
}
