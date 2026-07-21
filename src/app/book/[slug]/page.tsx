import { notFound } from "next/navigation";
import Link from "next/link";
import { AppHeader } from "@/components/marketplace/AppHeader";
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
      <main className="flex-1 px-5 py-6 md:px-8">
        <Link href={`/professionals/${pro.slug}`} className="mb-6 inline-block text-sm text-rose hover:underline">
          ← {pro.displayName}
        </Link>
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
