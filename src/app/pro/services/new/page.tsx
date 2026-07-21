import { redirect } from "next/navigation";
import Link from "next/link";
import { ProShell } from "@/components/pro/ProShell";
import { ServiceForm } from "@/components/pro/ServiceForm";
import { getProContext } from "@/lib/pro/context";

export const dynamic = "force-dynamic";

export default async function NewServicePage() {
  const ctx = await getProContext();
  if (!ctx.authed) redirect("/signin?next=/pro/services/new");

  return (
    <ProShell active="/pro/services" isDemo={ctx.isDemo}>
      <nav className="mb-4 text-sm">
        <Link href="/pro/services" className="text-rose hover:underline">
          ← Services
        </Link>
      </nav>
      <h1 className="mb-6 font-display text-2xl font-bold">New service</h1>
      <ServiceForm />
    </ProShell>
  );
}
