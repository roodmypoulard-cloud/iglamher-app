import "server-only";
// Aggregates the real data the Profile page needs: identity, account type/mode,
// pro status, and live counts for the quick-action tiles. Every count fails soft
// to 0 so the page renders even if one query errors (no crash, no fake numbers).
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { getAccountContext, type AccountContext } from "@/lib/profile/account";
import { getMyCustomerBookings, type BookingSummary } from "@/lib/booking/data";
import { isActive } from "@/lib/booking/status";
import { getMyConversations, type ConversationSummary } from "@/lib/messaging/data";
import { listMyCardsAction } from "@/lib/payments/payment-methods";
import { listCampaigns } from "@/lib/marketing/data";
import { isCampaignLive, type Campaign } from "@/lib/marketing/campaigns";

export interface ProfileOverview {
  userId: string;
  name: string;
  email: string;
  avatarUrl: string | null;
  location: string | null;
  isPro: boolean;
  isVerified: boolean;
  proSlug: string | null;
  proComplete: boolean; // pro profile exists AND was submitted for review
  account: AccountContext | null;
  counts: {
    favorites: number;
    upcomingBookings: number;
    conversations: number;
    pendingReviews: number;
    savedCards: number;
    activePromotions: number;
  };
}

type SB = Awaited<ReturnType<typeof createSupabaseServerClient>>;

async function countFavorites(supabase: SB, userId: string): Promise<number> {
  try {
    const { count } = await supabase.from("favorites").select("professional_id", { count: "exact", head: true }).eq("customer_id", userId);
    return count ?? 0;
  } catch {
    return 0;
  }
}

async function reviewedBookingIds(supabase: SB, userId: string): Promise<Set<string>> {
  try {
    const { data } = await supabase.from("reviews").select("booking_id").eq("reviewer_id", userId);
    return new Set(((data as { booking_id: string }[] | null) ?? []).map((x) => x.booking_id));
  } catch {
    return new Set<string>();
  }
}

export async function getProfileOverview(): Promise<ProfileOverview | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;
  const userId = auth.user.id;
  const email = auth.user.email ?? "";

  const [profileRow, proRow, account, bookings, conversations, favorites, reviewedIds, cardsRes, campaigns] = await Promise.all([
    supabase.from("profiles").select("full_name, avatar_url").eq("id", userId).maybeSingle(),
    supabase.from("professional_profiles").select("slug, city, is_verified, review_status, submitted_at").eq("user_id", userId).maybeSingle(),
    getAccountContext().catch(() => null),
    getMyCustomerBookings().catch((): BookingSummary[] => []),
    getMyConversations().catch((): ConversationSummary[] => []),
    countFavorites(supabase, userId),
    reviewedBookingIds(supabase, userId),
    listMyCardsAction().catch(() => ({ error: "unavailable" }) as { error: string }),
    listCampaigns().catch((): Campaign[] => []),
  ]);

  const p = profileRow.data as { full_name: string | null; avatar_url: string | null } | null;
  const pro = proRow.data as { slug: string | null; city: string | null; is_verified: boolean | null; review_status: string | null; submitted_at: string | null } | null;

  const upcomingBookings = bookings.filter((b) => isActive(b.status)).length;
  const pendingReviews = bookings.filter((b) => b.status === "completed" && !reviewedIds.has(b.id)).length;
  const savedCards = "cards" in cardsRes ? cardsRes.cards.length : 0;
  const now = new Date().toISOString();
  const activePromotions = campaigns.filter((cmp) => isCampaignLive(cmp, now)).length;

  const isPro = Boolean(pro) || account?.accountType === "professional" || account?.accountType === "both";
  const proComplete = Boolean(pro && (pro.submitted_at || (pro.review_status && pro.review_status !== "draft")));

  return {
    userId,
    name: p?.full_name || email.split("@")[0] || "You",
    email,
    avatarUrl: p?.avatar_url ?? null,
    location: pro?.city ?? null,
    isPro,
    isVerified: Boolean(pro?.is_verified),
    proSlug: pro?.slug ?? null,
    proComplete,
    account,
    counts: {
      favorites,
      upcomingBookings,
      conversations: conversations.length,
      pendingReviews,
      savedCards,
      activePromotions,
    },
  };
}
