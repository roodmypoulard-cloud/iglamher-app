import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { searchProfessionalViews } from "@/lib/data/professionals";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Search · iGlamHer" };

interface CustomerHit { id: string; first_name: string | null; last_name: string | null; email: string | null; role: string }

export default async function AdminSearchPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage("/admin/search");
  const { q } = await searchParams;
  const term = q?.trim() ?? "";

  const pros = term ? (await searchProfessionalViews({ q: term })).slice(0, 10) : [];

  let customers: CustomerHit[] = [];
  if (term && isLiveSupabase()) {
    const safe = term.replaceAll("%", "");
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, role")
      .or(`first_name.ilike.%${safe}%,last_name.ilike.%${safe}%,email.ilike.%${safe}%`)
      .limit(10);
    customers = (data ?? []) as CustomerHit[];
  }

  return (
    <div className="mx-auto max-w-4xl">
      <p className="mb-4 text-[13px] text-ink-muted">
        {term ? `Results for “${term}” across professionals and customers.` : "Type in the header search to look up professionals or customers."}
      </p>

      {term && pros.length === 0 && customers.length === 0 && (
        <div className="rounded-[16px] border border-border bg-surface px-6 py-12 text-center">
          <p className="font-display text-base font-bold text-ink">No matches for “{term}”</p>
          <p className="mt-1 text-[13px] text-ink-muted">Check the spelling, or try a partial name or email.</p>
        </div>
      )}

      {pros.length > 0 && (
        <section className="mb-6">
          <h2 className="mb-2 font-display text-base font-bold">Professionals</h2>
          <ul className="space-y-2">
            {pros.map((p) => (
              <li key={p.userId} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5">
                <Image src={p.avatarUrl} alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-[10px] object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-ink">{p.businessName || p.displayName}</p>
                  <p className="truncate text-[12px] text-ink-muted">{p.primarySpecialty} · {p.city}</p>
                </div>
                <Link href={`/admin/applications/${p.userId}`} className="flex-none rounded-full border border-rose/50 px-3 py-1.5 text-[12px] font-semibold text-rose hover:bg-rose/10">
                  Review
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {customers.length > 0 && (
        <section>
          <h2 className="mb-2 font-display text-base font-bold">Customers &amp; accounts</h2>
          <ul className="space-y-2">
            {customers.map((c) => {
              const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
              return (
                <li key={c.id}>
                  <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5 transition-colors hover:border-rose/50">
                    <span className="grid h-[38px] w-[38px] flex-none place-items-center rounded-full bg-rose/12 text-[13px] font-bold text-rose" aria-hidden>
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold text-ink">{name}</p>
                      <p className="truncate text-[12px] text-ink-muted">{c.email ?? "no email"} · {c.role}</p>
                    </div>
                    <span aria-hidden className="flex-none rounded-full border border-rose/50 px-3 py-1.5 text-[12px] font-semibold text-rose">View</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      )}
    </div>
  );
}
