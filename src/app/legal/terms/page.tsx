import { LegalLayout, H2 } from "@/components/legal/LegalLayout";

export const metadata = { title: "Terms of Service · iGlamHer" };

// NOTE: This is a plain-language template to be reviewed by counsel before launch.
export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="July 2026">
      <p>
        Welcome to iGlamHer. These Terms govern your use of the iGlamHer marketplace, which connects customers with
        independent beauty professionals. By using iGlamHer you agree to these Terms.
      </p>
      <H2>1. The marketplace</H2>
      <p>
        iGlamHer is a platform. Professionals are independent providers, not employees or agents of iGlamHer. We
        facilitate discovery, booking, secure payment, and communication, but the beauty services themselves are
        provided by the professional you book.
      </p>
      <H2>2. Accounts</H2>
      <p>
        You must provide accurate information and keep your credentials secure. You are responsible for activity under
        your account. Certain features require identity or professional verification.
      </p>
      <H2>3. Bookings &amp; payments</H2>
      <p>
        When you book, you authorize the listed charge (including any deposit). Payments are processed securely through
        Stripe. iGlamHer charges the professional a service commission on completed bookings. All prices are shown before
        you confirm.
      </p>
      <H2>4. Communication &amp; safety</H2>
      <p>
        To protect both parties, contact information may not be exchanged before a booking is confirmed and paid. In-app
        messaging and calling are provided so you never have to share your personal phone number. Harassment, fraud, and
        attempts to circumvent platform payments are prohibited.
      </p>
      <H2>5. Cancellations &amp; refunds</H2>
      <p>
        Cancellations are governed by the professional&apos;s policy and our <a href="/legal/cancellation" className="text-rose">Cancellation Policy</a>.
        Disputes may be submitted through the in-app dispute center.
      </p>
      <H2>6. Prohibited conduct</H2>
      <p>
        You may not misuse the platform, post unlawful or infringing content, create fraudulent accounts, or interfere
        with the service. We may suspend accounts that violate these Terms; we do not delete your data as a penalty.
      </p>
      <H2>7. Disclaimers &amp; liability</H2>
      <p>
        iGlamHer is provided &quot;as is.&quot; To the extent permitted by law, we are not liable for the acts of independent
        professionals or for indirect damages. Nothing here limits liability that cannot be limited by law.
      </p>
      <H2>8. Changes</H2>
      <p>We may update these Terms; material changes will be notified in-app. Continued use means acceptance.</p>
      <H2>9. Contact</H2>
      <p>Questions? Reach us at support@iglamher.com.</p>
    </LegalLayout>
  );
}
