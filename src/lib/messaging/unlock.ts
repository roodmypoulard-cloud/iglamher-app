import "server-only";
// Ensure a booking's conversation exists, both parties are members, and it is
// unlocked — called on payment confirmation from BOTH the Stripe webhook and the
// /book/success return. A DB trigger (migration 0014) normally creates the
// conversation on booking insert, but this is the defensive belt-and-suspenders
// path: if the trigger never ran (migration not applied) the earlier
// `update(is_unlocked).eq(booking_id)` was a silent no-op and messaging stayed
// dark. Fully idempotent via unique(booking_id) + the members PK.
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

/** Upsert the conversation + members for a booking and unlock it. Returns the
 *  conversation id (or null if the messaging tables aren't reachable). */
export async function ensureBookingConversationUnlocked(
  admin: Admin,
  bookingId: string,
  customerId: string | null | undefined,
  professionalId: string | null | undefined,
): Promise<string | null> {
  try {
    // Upsert the conversation on the unique booking_id and flip it unlocked.
    const { data } = await admin
      .from("conversations")
      .upsert({ booking_id: bookingId, is_unlocked: true }, { onConflict: "booking_id" })
      .select("id")
      .maybeSingle();
    let conversationId = (data as { id?: string } | null)?.id ?? null;
    if (!conversationId) {
      const { data: existing } = await admin
        .from("conversations")
        .select("id")
        .eq("booking_id", bookingId)
        .maybeSingle();
      conversationId = (existing as { id?: string } | null)?.id ?? null;
    }
    if (!conversationId) return null;

    // Make sure both parties are members (professional_id is a profiles.id via
    // professional_profiles.user_id, so it's a valid member).
    const members = [customerId, professionalId]
      .filter((id): id is string => Boolean(id))
      .map((user_id) => ({ conversation_id: conversationId as string, user_id }));
    if (members.length > 0) {
      await admin
        .from("conversation_members")
        .upsert(members, { onConflict: "conversation_id,user_id", ignoreDuplicates: true });
    }
    return conversationId;
  } catch {
    // Never let a messaging hiccup break payment confirmation.
    return null;
  }
}
