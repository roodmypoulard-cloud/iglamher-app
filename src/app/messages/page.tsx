import Link from "next/link";
import { Shell } from "@/components/marketplace/Shell";
import { EmptyState } from "@/components/ui/states";
import { Avatar } from "@/components/ui/Avatar";
import { getMyConversations } from "@/lib/messaging/data";

export const dynamic = "force-dynamic";

function fmtWhen(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  return sameDay
    ? d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export default async function MessagesPage() {
  const convos = await getMyConversations();

  return (
    <Shell>
      <h1 className="font-display text-[26px] font-bold leading-tight">Messages</h1>

      {convos.length === 0 ? (
        <div className="mt-6">
          <EmptyState
            title="No messages yet"
            body="Chat with your beauty pro unlocks once you've booked and paid — your conversations will appear here."
            action={{ label: "Find a pro", href: "/discover" }}
          />
        </div>
      ) : (
        <div className="stagger mt-4 space-y-2.5">
          {convos.map((c) => (
            <Link
              key={c.id}
              href={`/messages/${c.id}`}
              className="flex items-center gap-3 rounded-[16px] border border-border bg-surface p-3.5 transition-[transform,border-color] duration-200 hover:-translate-y-0.5 hover:border-rose/50"
            >
              <Avatar name={c.otherPartyName} size={48} />
              <div className="min-w-0 flex-1">
                <p className="flex items-center gap-2">
                  <span className="truncate font-display text-[16px] font-semibold leading-tight">
                    {c.otherPartyName}
                  </span>
                  {!c.isUnlocked && (
                    <span className="flex-none rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold text-ink-muted">
                      Locked
                    </span>
                  )}
                </p>
                <p className="mt-0.5 truncate text-[13px] text-ink-muted">
                  {c.lastMessagePreview ?? (c.serviceName ? `Booking · ${c.serviceName}` : "No messages yet")}
                </p>
              </div>
              <time className="flex-none text-[11px] text-ink-muted">{fmtWhen(c.lastMessageAt)}</time>
            </Link>
          ))}
        </div>
      )}
    </Shell>
  );
}
