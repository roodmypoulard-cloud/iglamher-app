import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import type { BookingStatus } from "./status";

export interface BookingSummary {
  id: string;
  status: BookingStatus;
  serviceName: string;
  startsAt: string;
  totalCents: number;
  professionalId: string;
  customerId: string;
  professionalName?: string;
}

const SELECT =
  "id,status,service_name_snapshot,starts_at,total_cents,professional_id,customer_id,professional:professional_profiles!bookings_professional_id_fkey(business_name)";

function mapRow(r: Record<string, unknown>): BookingSummary {
  const pro = r.professional as { business_name?: string } | null;
  return {
    id: String(r.id),
    status: r.status as BookingStatus,
    serviceName: String(r.service_name_snapshot ?? ""),
    startsAt: String(r.starts_at),
    totalCents: Number(r.total_cents ?? 0),
    professionalId: String(r.professional_id),
    customerId: String(r.customer_id),
    professionalName: pro?.business_name,
  };
}

export async function getMyCustomerBookings(): Promise<BookingSummary[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("customer_id", auth.user.id)
    .order("starts_at", { ascending: false });
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
}

export interface BookingDetail extends BookingSummary {
  endsAt: string;
  totalCents: number;
  subtotalCents: number;
  amountDueNowCents: number;
  paymentStatus: string;
  professionalSlug?: string;
  viewerRole: "customer" | "professional";
  reviewedByViewer: boolean;
  tipped: boolean;
}

/** Load one booking (customer OR professional party only). Returns null if it
 *  doesn't exist or the viewer isn't a party — the page shows 404 for null. */
export async function getBookingDetail(id: string): Promise<BookingDetail | null> {
  if (!isLiveSupabase()) return null;
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return null;

  const { data } = await supabase
    .from("bookings")
    .select(
      "id,status,service_name_snapshot,starts_at,ends_at,total_cents,subtotal_cents,amount_due_now_cents,professional_id,customer_id,professional:professional_profiles!bookings_professional_id_fkey(business_name,slug)",
    )
    .eq("id", id)
    .maybeSingle();
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  if (r.customer_id !== auth.user.id && r.professional_id !== auth.user.id) return null;

  const viewerRole = r.professional_id === auth.user.id ? "professional" : "customer";
  // Has the viewer already reviewed (in their direction)? Has a tip been left?
  // Degrades to false if migrations 0020/0021 aren't applied.
  const dir = viewerRole === "professional" ? "pro_to_customer" : "customer_to_pro";
  let reviewedByViewer = false;
  let tipped = false;
  const { data: rev } = await supabase.from("reviews").select("id").eq("booking_id", id).eq("direction", dir).maybeSingle();
  reviewedByViewer = Boolean(rev);
  const { data: tip } = await supabase.from("tips").select("id").eq("booking_id", id).maybeSingle();
  tipped = Boolean(tip);

  // Payment status: prefer the payments row; fall back to booking-status-derived.
  let paymentStatus = "unpaid";
  const { data: pay } = await supabase
    .from("payments")
    .select("status")
    .eq("booking_id", id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  const payStatus = (pay as { status?: string } | null)?.status;
  if (payStatus) paymentStatus = payStatus;
  else if (["confirmed", "in_progress", "completed"].includes(String(r.status))) paymentStatus = "paid";

  const pro = r.professional as { business_name?: string; slug?: string } | null;
  return {
    ...mapRow(r),
    endsAt: String(r.ends_at ?? ""),
    totalCents: Number(r.total_cents ?? 0),
    subtotalCents: Number(r.subtotal_cents ?? r.total_cents ?? 0),
    amountDueNowCents: Number(r.amount_due_now_cents ?? 0),
    paymentStatus,
    professionalSlug: pro?.slug,
    viewerRole,
    reviewedByViewer,
    tipped,
  };
}

export async function getMyProfessionalBookings(): Promise<BookingSummary[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await supabase.auth.getUser();
  if (!auth.user) return [];
  const { data } = await supabase
    .from("bookings")
    .select(SELECT)
    .eq("professional_id", auth.user.id)
    .order("starts_at", { ascending: true });
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
}
