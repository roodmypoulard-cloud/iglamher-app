import { notFound } from "next/navigation";
import { AppHeader } from "@/components/marketplace/AppHeader";
import { BackButton } from "@/components/ui/BackButton";
import { BookingFlow } from "@/components/booking/BookingFlow";
import { getProfessionalBySlug } from "@/lib/data/professionals";
import { publicServices } from "@/lib/marketplace/visibility";

export const dynamic = "force-dynamic";
export const metadata = { title: "Book · iGlamHer" };

export default async function BookPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ service?: string }>;
}) {
  const { slug } = await params;
  const { service } = await searchParams;
  const pro = await getProfessionalBySlug(slug);
  if (!pro) notFound();

  const services = publicServices(pro);
  // If a service was pre-selected via ?service=, put it first.
  const ordered = service ? [...services].sort((a, b) => (a.id === service ? -1 : b.id === service ? 1 : 0)) : services;

  const config = {
    timezone: pro.timezone,
    rules: pro.availability,
    exceptions: pro.exceptions,
    minNoticeMinutes: 120,
    maxWindowDays: 60,
  };

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[1280px] flex-col">
      <AppHeader />
      <main className="mx-auto w-full max-w-2xl flex-1 px-5 py-6 md:px-8 md:py-10">
        <div className="mb-6">
          <BackButton fallback={`/professionals/${pro.slug}`} label={pro.displayName} />
        </div>
        {ordered.length === 0 ? (
          <p className="text-sm text-ink-muted">This professional has no bookable services yet.</p>
        ) : (
          <BookingFlow
            professionalId={pro.userId}
            professionalName={pro.displayName}
            services={ordered}
            addons={pro.addons.filter((a) => a.isActive)}
            config={config}
          />
        )}
      </main>
    </div>
  );
}
