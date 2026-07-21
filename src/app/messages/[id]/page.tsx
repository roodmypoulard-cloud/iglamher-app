import { notFound } from "next/navigation";
import Link from "next/link";
import { getConversationThread } from "@/lib/messaging/data";
import { MessageComposer } from "@/components/messaging/MessageComposer";
import { Avatar } from "@/components/ui/Avatar";
import { ChevronRight } from "@/components/ui/icons";

export const dynamic = "force-dynamic";

function fmtTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" });
}

export default async function ThreadPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const thread = await getConversationThread(id);
  if (!thread) notFound();

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[440px] flex-col md:max-w-3xl">
      <header
        className="sticky top-0 z-20 flex items-center gap-3 border-b border-border/60 bg-bg/85 px-4 py-3 backdrop-blur-md"
        style={{ paddingTop: "calc(env(safe-area-inset-top) + 0.6rem)" }}
      >
        <Link
          href="/messages"
          aria-label="Back to messages"
          className="grid h-9 w-9 flex-none place-items-center rounded-full text-ink-secondary transition-colors hover:bg-surface-hover"
        >
          <ChevronRight className="rotate-180" width={20} height={20} />
        </Link>
        <Avatar name={thread.otherPartyName} size={38} />
        <div className="min-w-0">
          <p className="truncate font-display text-[17px] font-semibold leading-tight">{thread.otherPartyName}</p>
          {thread.serviceName && <p className="truncate text-[11.5px] text-ink-muted">{thread.serviceName}</p>}
        </div>
      </header>

      <main className="flex-1 space-y-2 px-4 py-4">
        {thread.messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-ink-muted">
            {thread.isUnlocked
              ? "Say hi \u{1F44B} — start the conversation."
              : "This chat unlocks once your booking is confirmed. You can still send a message."}
          </p>
        ) : (
          thread.messages.map((m) => (
            <div key={m.id} className={m.mine ? "flex justify-end" : "flex justify-start"}>
              <div
                className={`max-w-[78%] rounded-[16px] px-3.5 py-2 text-[14.5px] ${
                  m.mine ? "rose-gradient text-[#2A1712]" : "border border-border bg-surface text-ink"
                }`}
              >
                <p className="whitespace-pre-wrap break-words">{m.body}</p>
                <p className={`mt-0.5 text-[10px] ${m.mine ? "text-[#2A1712]/60" : "text-ink-muted"}`}>
                  {fmtTime(m.createdAt)}
                </p>
              </div>
            </div>
          ))
        )}
      </main>

      <MessageComposer conversationId={thread.id} locked={!thread.isUnlocked} />
    </div>
  );
}
