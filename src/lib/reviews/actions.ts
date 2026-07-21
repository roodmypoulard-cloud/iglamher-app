"use server";
// Two-way reviews. Server-authoritative: booking must be completed, the author
// must be the correct participant for the direction, one review per direction
// (DB unique + trigger enforce). Notifies the reviewee.
import { z } from "zod";
import { revalidatePath } from "next/cache";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";

export type ReviewState = { error?: string; success?: string } | undefined;

const schema = z.object({
  rating: z.coerce.number().int().min(1, "Pick a rating").max(5),
  body: z.string().trim().max(1500).optional().or(z.literal("")),
  direction: z.enum(["customer_to_pro", "pro_to_customer"]),
  quality: z.coerce.number().int().min(1).max(5).optional(),
  punctuality: z.coerce.number().int().min(1).max(5).optional(),
  professionalism: z.coerce.number().int().min(1).max(5).optional(),
  communication: z.coerce.number().int().min(1).max(5).optional(),
  respectfulness: z.coerce.number().int().min(1).max(5).optional(),
});

export async function submitReviewAction(bookingId: string, _prev: ReviewState, formData: FormData): Promise<ReviewState> {
  if (!isLiveSupabase()) return { error: "Reviews require the live backend." };
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return { error: "Please sign in." };

  const parsed = schema.safeParse(Object.fromEntries(formData.entries()));
  if (!parsed.success) return { error: "Please choose a 1–5 star rating." };
  const v = parsed.data;

  const { data: bk } = await supabase
    .from("bookings")
    .select("status, customer_id, professional_id")
    .eq("id", bookingId)
    .maybeSingle();
  const b = bk as { status?: string; customer_id?: string; professional_id?: string } | null;
  if (!b) return { error: "Booking not found." };
  if (b.status !== "completed") return { error: "You can review once the appointment is completed." };
  const isCustomer = b.customer_id === auth.user.id;
  const isPro = b.professional_id === auth.user.id;
  if (!isCustomer && !isPro) return { error: "Only participants in this booking can review." };
  if (v.direction === "customer_to_pro" && !isCustomer) return { error: "Only the customer can leave this review." };
  if (v.direction === "pro_to_customer" && !isPro) return { error: "Only the professional can leave this review." };

  const categories =
    v.direction === "customer_to_pro"
      ? { rating_quality: v.quality ?? null, rating_punctuality: v.punctuality ?? null, rating_professionalism: v.professionalism ?? null, rating_communication: v.communication ?? null }
      : { rating_punctuality: v.punctuality ?? null, rating_communication: v.communication ?? null, rating_respectfulness: v.respectfulness ?? null };

  const { error } = await supabase.from("reviews").insert({
    booking_id: bookingId,
    customer_id: b.customer_id,
    professional_id: b.professional_id,
    reviewer_id: auth.user.id,
    direction: v.direction,
    rating: v.rating,
    body: v.body || null,
    ...categories,
  });
  if (error) {
    if (/duplicate|unique|already/i.test(error.message)) return { error: "You've already reviewed this booking." };
    return { error: error.message };
  }

  // Notify the reviewee (best-effort, via service role).
  const revieweeId = v.direction === "customer_to_pro" ? b.professional_id! : b.customer_id!;
  try {
    const admin = createAdminClient();
    await admin.from("notifications").insert({
      user_id: revieweeId,
      type: "review",
      title: "New review",
      body: `You received a ${v.rating}★ review.`,
      data: { bookingId },
    });
  } catch { /* notifications are best-effort */ }

  revalidatePath(`/bookings/${bookingId}`);
  return { success: "Thanks — your review was posted." };
}
