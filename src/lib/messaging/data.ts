import "server-only";
// Read layer for messaging. Uses the user-scoped client so RLS enforces that a
// user only ever sees conversations they're a member of.
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";

export interface ConversationSummary {
  id: string;
  bookingId: string | null;
  otherPartyName: string;
  serviceName: string;
  isUnlocked: boolean;
  lastMessagePreview: string | null;
  lastMessageAt: string | null;
}

export interface ThreadMessage {
  id: string;
  senderId: string;
  body: string | null;
  createdAt: string;
  mine: boolean;
}

export interface ConversationThread {
  id: string;
  otherPartyName: string;
  serviceName: string;
  isUnlocked: boolean;
  meId: string;
  messages: ThreadMessage[];
}

type BookingJoin = {
  service_name_snapshot?: string | null;
  customer_id?: string | null;
  professional_id?: string | null;
  customer?: { full_name?: string | null } | null;
  professional?: { business_name?: string | null } | null;
} | null;

const CONVO_SELECT =
  "id, booking_id, last_message_at, is_unlocked, booking:bookings(service_name_snapshot, customer_id, professional_id, customer:profiles!bookings_customer_id_fkey(full_name), professional:professional_profiles!bookings_professional_id_fkey(business_name))";

function otherParty(meId: string, booking: BookingJoin): string {
  if (!booking) return "Conversation";
  // If I'm the customer, the other party is the professional, and vice-versa.
  if (booking.customer_id === meId) return booking.professional?.business_name || "Your pro";
  return booking.customer?.full_name || "Customer";
}

export async function getMyConversations(): Promise<ConversationSummary[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const meId = auth.user.id;

  const { data: convos } = await supabase
    .from("conversations")
    .select(CONVO_SELECT)
    .order("last_message_at", { ascending: false, nullsFirst: false });
  const rows = (convos as unknown as Array<Record<string, unknown>>) ?? [];
  if (rows.length === 0) return [];

  // Latest message per conversation for the preview (one query, reduced client-side).
  const ids = rows.map((r) => String(r.id));
  const { data: msgs } = await supabase
    .from("messages")
    .select("conversation_id, body, blocked, created_at")
    .in("conversation_id", ids)
    .order("created_at", { ascending: false });
  const previewByConvo = new Map<string, { body: string | null; at: string }>();
  for (const m of (msgs as Array<Record<string, unknown>>) ?? []) {
    const cid = String(m.conversation_id);
    if (previewByConvo.has(cid) || m.blocked) continue; // first (latest) non-blocked wins
    previewByConvo.set(cid, { body: (m.body as string | null) ?? null, at: String(m.created_at) });
  }

  return rows.map((r) => {
    const booking = r.booking as BookingJoin;
    const preview = previewByConvo.get(String(r.id));
    return {
      id: String(r.id),
      bookingId: (r.booking_id as string | null) ?? null,
      otherPartyName: otherParty(meId, booking),
      serviceName: booking?.service_name_snapshot ?? "",
      isUnlocked: Boolean(r.is_unlocked),
      lastMessagePreview: preview?.body ?? null,
      lastMessageAt: (r.last_message_at as string | null) ?? preview?.at ?? null,
    };
  });
}

export async function getConversationThread(id: string): Promise<ConversationThread | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const meId = auth.user.id;

  const { data: convo } = await supabase.from("conversations").select(CONVO_SELECT).eq("id", id).maybeSingle();
  if (!convo) return null; // RLS: not a member → not found
  const c = convo as unknown as Record<string, unknown>;
  const booking = c.booking as BookingJoin;

  const { data: msgs } = await supabase
    .from("messages")
    .select("id, sender_id, body, blocked, created_at")
    .eq("conversation_id", id)
    .order("created_at", { ascending: true });

  const messages: ThreadMessage[] = ((msgs as Array<Record<string, unknown>>) ?? [])
    .filter((m) => !m.blocked)
    .map((m) => ({
      id: String(m.id),
      senderId: String(m.sender_id),
      body: (m.body as string | null) ?? null,
      createdAt: String(m.created_at),
      mine: String(m.sender_id) === meId,
    }));

  return {
    id,
    otherPartyName: otherParty(meId, booking),
    serviceName: booking?.service_name_snapshot ?? "",
    isUnlocked: Boolean(c.is_unlocked),
    meId,
    messages,
  };
}
