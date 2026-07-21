import { LegalLayout, H2 } from "@/components/legal/LegalLayout";

export const metadata = { title: "How it works · iGlamHer" };

export default function HowItWorksPage() {
  return (
    <LegalLayout title="How it works" updated="July 2026">
      <H2>For customers</H2>
      <ol className="list-decimal space-y-2 pl-5">
        <li><strong className="text-ink">Discover.</strong> Browse or search by service, style, budget, or &quot;near me.&quot; See portfolios, verified reviews, and transparent pricing.</li>
        <li><strong className="text-ink">Book.</strong> Pick a service and an available time. Review the price and cancellation policy up front.</li>
        <li><strong className="text-ink">Pay securely.</strong> Pay a deposit or the total through Stripe. Your booking is confirmed instantly.</li>
        <li><strong className="text-ink">Connect.</strong> Message and call your pro inside the app — no phone numbers exchanged.</li>
        <li><strong className="text-ink">Enjoy &amp; earn.</strong> Get glammed, leave a review, and earn iGlam Rewards points on every booking.</li>
      </ol>
      <H2>For professionals</H2>
      <ol className="list-decimal space-y-2 pl-5">
        <li><strong className="text-ink">Set up.</strong> Create your profile, add services and prices, upload your portfolio, and get verified.</li>
        <li><strong className="text-ink">Get booked.</strong> Appear in search and recommendations; set your availability and buffers.</li>
        <li><strong className="text-ink">Get paid.</strong> Secure payouts after each completed booking — you keep the majority.</li>
        <li><strong className="text-ink">Grow.</strong> Track earnings, repeat clients, and trends; get tips to fill your calendar.</li>
      </ol>
    </LegalLayout>
  );
}
