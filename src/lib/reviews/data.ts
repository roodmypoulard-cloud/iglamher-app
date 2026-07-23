// Public "Real Reviews" showcase data access. Reads already-published,
// customer→pro reviews (each tied to a completed booking by a DB eligibility
// trigger, so every one qualifies for a "Verified Booking" badge).
//
// CLIENT CHOICE: the `profiles` RLS policy is `auth.uid() = id or is_admin`,
// so the anon/public client cannot read the customer's name for the join.
// This is a public showcase of names already shown publicly on pro profiles,
// so we read with the service-role admin client (server-only) and only ever
// select published, public-facing (customer_to_pro) rows.
import "server-only";
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { withTimeout } from "@/lib/util/timeout";

export interface PublicReview {
  id: string;
  customerName: string;
  customerInitials: string;
  providerName: string;
  providerSlug: string | null;
  rating: number; // 1-5
  body: string;
  createdAt: string; // ISO string
  verified: true;
  photos: string[]; // no photo columns yet — always [] (future-proof)
}

// Shape returned from Supabase (snake_case). Only the fields we map.
interface ReviewJoinRow {
  id: string;
  rating: number;
  body: string | null;
  created_at: string;
  customer: { first_name: string | null; last_name: string | null; full_name: string | null } | null;
  professional: { business_name: string | null; slug: string | null } | null;
}

const REVIEW_SELECT =
  "id, rating, body, created_at, " +
  "customer:profiles!customer_id(first_name, last_name, full_name), " +
  "professional:professional_profiles!professional_id(business_name, slug)";

/** Prefer the customer's first name; fall back to full name, then "Verified client". */
function displayName(c: ReviewJoinRow["customer"]): string {
  const first = c?.first_name?.trim();
  if (first) return first;
  const full = c?.full_name?.trim();
  if (full) return full.split(/\s+/)[0];
  const last = c?.last_name?.trim();
  if (last) return last;
  return "Verified client";
}

/** Compute up-to-two-letter initials from the available name parts. */
function initialsFor(c: ReviewJoinRow["customer"]): string {
  const first = c?.first_name?.trim();
  const last = c?.last_name?.trim();
  if (first || last) {
    return `${first?.charAt(0) ?? ""}${last?.charAt(0) ?? ""}`.toUpperCase() || "•";
  }
  const full = c?.full_name?.trim();
  if (full) {
    const parts = full.split(/\s+/);
    return `${parts[0]?.charAt(0) ?? ""}${parts.length > 1 ? parts[parts.length - 1].charAt(0) : ""}`.toUpperCase() || "•";
  }
  return "•";
}

export async function getPublicReviews(limit = 40): Promise<PublicReview[]> {
  if (!isLiveSupabase()) return [];

  const supabase = createAdminClient();
  try {
    const { data, error } = await withTimeout(
      supabase
        .from("reviews")
        .select(REVIEW_SELECT)
        .eq("is_published", true)
        .eq("direction", "customer_to_pro")
        .order("created_at", { ascending: false })
        .limit(limit),
      6000,
      "getPublicReviews",
    );
    if (error || !data) return [];

    return (data as unknown as ReviewJoinRow[]).map((r) => ({
      id: r.id,
      customerName: displayName(r.customer),
      customerInitials: initialsFor(r.customer),
      providerName: r.professional?.business_name ?? "iGlamHer pro",
      providerSlug: r.professional?.slug ?? null,
      rating: r.rating,
      body: r.body ?? "",
      createdAt: r.created_at,
      verified: true as const,
      photos: [], // no review photo columns yet; UI renders a grid when populated
    }));
  } catch {
    // Timeout or transient failure — the showcase degrades to an empty state.
    return [];
  }
}
