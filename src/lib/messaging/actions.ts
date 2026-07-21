"use server";
// Message sending with the pre-payment contact-info guard enforced SERVER-SIDE.
// Before a conversation is unlocked (payment confirmed), any message containing
// contact info is rejected; the attempt is logged flagged/redacted for safety.
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { scanForContactInfo, guardMessage } from "./contact-guard";

const schema = z.object({
  conversationId: z.string().uuid(),
  body: z.string().trim().min(1).max(2000),
});

export type SendResult = { ok: true } | { ok: false; error: string; blocked?: boolean };

export async function sendMessageAction(raw: unknown): Promise<SendResult> {
  const parsed = schema.safeParse(raw);
  if (!parsed.success) return { ok: false, error: "Message can't be empty." };
  const { conversationId, body } = parsed.data;

  if (!isLiveSupabase()) return { ok: false, error: "Connect Supabase to send messages." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { ok: false, error: "Please sign in." };

  // Membership is enforced by RLS too; check unlock state here for the guard.
  const { data: convo } = await supabase
    .from("conversations")
    .select("is_unlocked")
    .eq("id", conversationId)
    .maybeSingle();
  if (!convo) return { ok: false, error: "Conversation not found." };
  const unlocked = (convo as { is_unlocked: boolean }).is_unlocked;

  const scan = scanForContactInfo(body);
  if (!unlocked && scan.blocked) {
    // Log the blocked attempt (redacted) for trust & safety, then reject.
    await supabase.from("messages").insert({
      conversation_id: conversationId,
      sender_id: auth.user.id,
      body: null,
      redacted_body: scan.redacted,
      flagged: true,
      blocked: true,
    });
    return { ok: false, blocked: true, error: guardMessage(scan) };
  }

  const { error } = await supabase.from("messages").insert({
    conversation_id: conversationId,
    sender_id: auth.user.id,
    body,
    flagged: scan.blocked, // flag but allow once unlocked
  });
  if (error) return { ok: false, error: error.message };
  await supabase.from("conversations").update({ last_message_at: new Date().toISOString() }).eq("id", conversationId);
  return { ok: true };
}
