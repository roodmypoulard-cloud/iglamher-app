import Image from "next/image";
import Link from "next/link";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Customers · iGlamHer" };

interface CustomerRow {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  role: string;
  account_status: string | null;
  created_at: string;
}

export default async function AdminCustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  await requireAdminPage("/admin/customers");
  const { q } = await searchParams;

  let rows: CustomerRow[] = [];
  if (isLiveSupabase()) {
    const admin = createAdminClient();
    let query = admin
      .from("profiles")
      .select("id, first_name, last_name, email, avatar_url, role, account_status, created_at")
      .eq("role", "customer")
      .order("created_at", { ascending: false })
      .limit(50);
    if (q?.trim()) {
      const term = q.trim().replaceAll("%", "");
      query = query.or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`);
    }
    const { data } = await query;
    rows = (data ?? []) as CustomerRow[];
  }

  return (
    <div className="mx-auto max-w-4xl">
      <form className="mb-4" role="search">
        <input
          type="search"
          name="q"
          defaultValue={q ?? ""}
          placeholder="Search customers by name or email…"
          aria-label="Search customers"
          className="w-full max-w-sm rounded-[10px] border border-border bg-surface px-3.5 py-2.5 text-[13px] text-ink placeholder:text-ink-muted focus:border-rose focus:outline-none"
        />
      </form>
      {rows.length === 0 ? (
        <div className="rounded-[16px] border border-border bg-surface px-6 py-12 text-center">
          <p className="font-display text-base font-bold text-ink">{q ? `No customers match “${q}”` : "No customers found"}</p>
          {q && <p className="mt-1 text-[13px] text-ink-muted">Try a shorter name or a different email.</p>}
        </div>
      ) : (
        <ul className="space-y-2">
          {rows.map((c) => {
            const name = `${c.first_name ?? ""} ${c.last_name ?? ""}`.trim() || "—";
            const status = c.account_status ?? "active";
            return (
              <li key={c.id}>
                <Link href={`/admin/customers/${c.id}`} className="flex items-center gap-3 rounded-[14px] border border-border bg-surface p-3.5 transition-colors hover:border-rose/50">
                  {c.avatar_url ? (
                    <Image src={c.avatar_url} alt="" width={38} height={38} className="h-[38px] w-[38px] rounded-full object-cover" />
                  ) : (
                    <span className="grid h-[38px] w-[38px] place-items-center rounded-full bg-rose/12 text-[13px] font-bold text-rose" aria-hidden>
                      {name.slice(0, 1).toUpperCase()}
                    </span>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-bold text-ink">{name}</p>
                    <p className="truncate text-[12px] text-ink-muted">{c.email ?? "no email"} · joined {new Date(c.created_at).toLocaleDateString("en-US", { month: "short", year: "numeric" })}</p>
                  </div>
                  <span
                    className={`flex-none rounded-full px-2.5 py-1 text-[10.5px] font-bold uppercase tracking-wide ${
                      status === "active" ? "bg-success/15 text-success" : status === "paused" ? "bg-warning/15 text-warning" : "bg-danger/15 text-danger"
                    }`}
                  >
                    {status}
                  </span>
                  <span aria-hidden className="flex-none text-[13px] font-semibold text-rose">View →</span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
