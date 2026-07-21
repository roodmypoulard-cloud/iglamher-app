import { LegalLayout, H2 } from "@/components/legal/LegalLayout";

export const metadata = { title: "About · iGlamHer" };

export default function AboutPage() {
  return (
    <LegalLayout title="About iGlamHer" updated="July 2026">
      <p>
        iGlamHer is a luxury beauty-services marketplace. We connect you with trusted, verified hair, makeup, lash, and
        styling professionals — bookable in seconds, paid securely, with everything handled in one place.
      </p>
      <H2>Why we built it</H2>
      <p>
        Finding a great beauty pro shouldn&apos;t mean scrolling DMs and chasing quotes. iGlamHer brings real portfolios,
        transparent pricing, verified reviews, and instant booking together — so you can find the right artist and book
        with confidence.
      </p>
      <H2>Trust &amp; safety first</H2>
      <p>
        Professionals are identity-verified, communication stays inside the app until a booking is confirmed, and secure
        in-app messaging and calling mean you never share your personal number. Payments are protected, and our dispute
        center has your back.
      </p>
      <H2>For professionals</H2>
      <p>
        iGlamHer gives independent beauty pros a storefront, calendar, secure payments, growth analytics, and a stream of
        new clients — keeping the majority of every booking.
      </p>
    </LegalLayout>
  );
}
