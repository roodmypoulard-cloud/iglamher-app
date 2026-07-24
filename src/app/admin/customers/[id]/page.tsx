import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { requireAdminPage } from "@/lib/admin/require-admin-page";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export const dynamic = "force-dynamic";
export const metadata = { title: "Customer · Admin · iGlamHer" };

interface Row {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  avatar_url: string | null;
  phone: string | null;
  role: string;
  account_status: string | null;
  created_at: string;
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-[11px] uppercase tracking-wide text-ink-muted">{label}</dt>
      <dd className="mt-0.5 font-medium text-ink">{value || "—"}</dd>
    </div>
  );
}

export default async function AdminCustomerDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireAdminPage("/admin/customers");
  const { id } = await params;

  let row: Row | null = null;
  if (isLiveSupabase()) {
    const admin = createAdminClient();
    const { data } = await admin
      .from("profiles")
      .select("id, first_name, last_name, email, avatar_url, phone, role, account_status, created_at")
      .eq("id", id)
      .maybeSingle();
    row = (data as Row | null) ?? null;
  }
  if (!row) notFound();

  const name = `${row.first_name ?? ""} ${row.last_name ?? ""}`.trim() || "—";
  const status = row.account_status ?? "active";

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/admin/customers" className="text-sm text-rose hover:underline">← All customers</Link>

      <section className="mt-4 rounded-[18px] border border-border bg-surface p-5">
        <div className="flex items-center gap-4">
          {row.avatar_url ? (
            <Image src={row.avatar_url} alt="" width={64} height={64} className="h-16 w-16 rounded-full object-cover" />
          ) : (
            <span className="grid h-16 w-16 place-items-center rounded-full bg-rose/12 text-2xl font-bold text-rose" aria-hidden>
              {name.slice(0, 1).toUpperCase()}
            </span>
          )}
          <div className="min-w-0">
            <h1 className="font-display text-2xl font-bold text-ink">{name}</h1>
            <p className="text-sm text-ink-muted">{row.email ?? "no email"}</p>
          </div>
          <span
            className={`ml-auto flex-none rounded-full px-3 py-1 text-[11px] font-bold uppercase tracking-wide ${
              status === "active" ? "bg-success/15 text-success" : status === "paused" ? "bg-warning/15 text-warning" : "bg-danger/15 text-danger"
            }`}
          >
            {status}
          </span>
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-x-4 gap-y-4 text-sm">
          <Field label="Role" value={row.role} />
          <Field label="Phone" value={row.phone ?? "—"} />
          <Field label="Joined" value={new Date(row.created_at).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })} />
          <Field label="Account status" value={status} />
        </dl>
      </section>

      <div className="mt-4 rounded-[16px] border border-rose/25 bg-rose/[0.05] px-4 py-3">
        <p className="text-sm font-semibold text-ink">Account management tools coming soon</p>
        <p className="mt-1 text-[12.5px] leading-relaxed text-ink-secondary">
          Suspend, message, and refund controls for customer accounts land here next. For now, use Disputes for
          moderation and the customer&apos;s own settings for account changes.
        </p>
      </div>
    </div>
  );
}
