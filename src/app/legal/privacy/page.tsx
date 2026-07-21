import { LegalLayout, H2 } from "@/components/legal/LegalLayout";

export const metadata = { title: "Privacy Policy · iGlamHer" };

// NOTE: Template for counsel review. Required for App Store / Google Play submission.
export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="July 2026">
      <p>
        This Privacy Policy explains what iGlamHer collects, how we use it, and your choices. We designed iGlamHer to
        collect only what&apos;s needed to run a trusted marketplace.
      </p>
      <H2>Information we collect</H2>
      <p>
        Account details (name, email, phone), booking and payment records (payments are processed by Stripe; we store
        references, not full card numbers), messages sent through the platform, approximate location for &quot;near me&quot;
        search, device and usage data, and — for professionals — verification documents.
      </p>
      <H2>How we use it</H2>
      <p>
        To provide bookings and payments, match you with professionals, keep the marketplace safe (fraud prevention,
        verification, moderation), send booking and account notifications, and improve the product. We never sell your
        personal data.
      </p>
      <H2>Verification documents</H2>
      <p>
        Identity and license documents are stored in encrypted, private storage and are accessible only to authorized
        reviewers via short-lived signed links. Every access is logged.
      </p>
      <H2>Sharing</H2>
      <p>
        We share the minimum necessary with service providers (e.g., Stripe for payments, our cloud database) under
        contract, and with the professional you book (only what a booking requires). We disclose information if required
        by law.
      </p>
      <H2>Your choices</H2>
      <p>
        You can access and update your profile, manage notification preferences, and request deletion of your account.
        Some records are retained where required for legal, tax, or fraud-prevention purposes.
      </p>
      <H2>Security</H2>
      <p>
        Data is encrypted in transit and at rest, access is controlled by row-level security and role-based permissions,
        and sensitive actions are audit-logged.
      </p>
      <H2>Children</H2>
      <p>iGlamHer is not intended for anyone under 18.</p>
      <H2>Contact</H2>
      <p>Privacy questions: privacy@iglamher.com.</p>
    </LegalLayout>
  );
}
