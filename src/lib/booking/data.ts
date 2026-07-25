import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isLiveSupabase } from "@/lib/data/source";
import { withTimeout } from "@/lib/util/timeout";
import { displayAddress, type AddressParts } from "@/lib/pro/compliance";
import type { BookingStatus } from "./status";

// Every DB round-trip in this module is bounded: a hung query rejects after 6s
// so the page's error boundary fires instead of leaving a permanent skeleton.
const DB_TIMEOUT_MS = 6000;

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
  // Best-effort: this feeds the Discover recommendations and the account bookings
  // list. On a DB error/timeout, degrade to an empty list rather than throwing and
  // taking down the whole page (recommendations are non-critical personalization).
  try {
    const supabase = await createSupabaseServerClient();
    const { data: auth } = await withTimeout(supabase.auth.getUser(), DB_TIMEOUT_MS, "auth.getUser");
    if (!auth.user) return [];
    const { data, error } = await withTimeout(
      supabase.from("bookings").select(SELECT).eq("customer_id", auth.user.id).order("starts_at", { ascending: false }),
      DB_TIMEOUT_MS,
      "customer bookings",
    );
    if (error) throw new Error(`Failed to load bookings: ${error.message}`);
    return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
  } catch (e) {
    console.error("[bookings] getMyCustomerBookings failed", e instanceof Error ? e.message : e);
    return [];
  }
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
  conversationId: string | null;
  messagingUnlocked: boolean;
  /** C3: where the appointment happens, already redacted for this viewer.
   *  `exact: false` ⇒ approximate area only, because the booking isn't yet
   *  confirmed + paid. Never contains a street address unless `exact` is true. */
  professionalLocation: { text: string; exact: boolean };
  /** Pending reschedule proposal (status = change_requested). Null when there is
   *  none or migration 0036 hasn't landed (degrades to no reschedule UI). */
  proposedChange: { startsAt: string; endsAt: string; note: string | null; requestedByViewer: boolean } | null;
}

/** The exact address unlocks only once the booking is actually locked in:
 *  confirmed (or later) AND paid. Everything else sees the neighborhood. */
function addressUnlocked(status: string, paymentStatus: string): boolean {
  const committed = ["confirmed", "in_progress", "completed"].includes(status);
  const paid = ["paid", "succeeded"].includes(paymentStatus);
  return committed && paid;
}

/** Read a pro's address parts for the CURRENT viewer.
 *
 *  The street address lives in `professional_private_locations` (0034), whose
 *  RLS only returns a row to the pro themselves, an admin, or a customer with a
 *  committed booking against that pro. This read runs on the viewer's own
 *  session, so an unentitled viewer gets no row back — the redaction is enforced
 *  by the database, not by the `audience` argument we pass afterwards.
 *
 *  Best-effort per group: `neighborhood` (0033), `hide_exact_pin` (0032) and the
 *  private table (0034) may be absent on an unmigrated deploy, and any failure
 *  must degrade to "hidden", never to "show the street address". */
async function fetchProAddress(
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
  professionalId: string,
): Promise<{ parts: AddressParts; hideExactPin: boolean }> {
  const [base, privacy, priv] = await Promise.all([
    supabase.from("professional_profiles").select("city,postal_code").eq("user_id", professionalId).maybeSingle(),
    supabase.from("professional_profiles").select("neighborhood,hide_exact_pin").eq("user_id", professionalId).maybeSingle(),
    supabase.from("professional_private_locations").select("studio_address").eq("user_id", professionalId).maybeSingle(),
  ]);
  const b = (base.data ?? {}) as { city?: string | null; postal_code?: string | null };
  const p = (privacy.data ?? {}) as { neighborhood?: string | null; hide_exact_pin?: boolean | null };
  const s = (priv.data ?? {}) as { studio_address?: string | null };
  return {
    parts: { addressLine1: s.studio_address, city: b.city, postalCode: b.postal_code, neighborhood: p.neighborhood },
    // Missing column / failed read ⇒ hidden. Fail closed.
    hideExactPin: privacy.error ? true : p.hide_exact_pin ?? true,
  };
}

/** Load one booking (customer OR professional party only). Returns null if it
 *  doesn't exist or the viewer isn't a party — the page shows 404 for null. */
export async function getBookingDetail(id: string): Promise<BookingDetail | null> {
  if (!isLiveSupabase()) return null;
  // Guard against a missing/blank dynamic route id before touching the DB.
  if (!id || typeof id !== "string" || id.trim() === "") return null;

  const supabase = await createSupabaseServerClient();
  const { data: auth } = await withTimeout(supabase.auth.getUser(), DB_TIMEOUT_MS, "auth.getUser");
  if (!auth.user) return null;

  const { data, error } = await withTimeout(
    supabase
      .from("bookings")
      .select(
        "id,status,service_name_snapshot,starts_at,ends_at,total_cents,subtotal_cents,amount_due_now_cents,professional_id,customer_id,professional:professional_profiles!bookings_professional_id_fkey(business_name,slug)",
      )
      .eq("id", id)
      .maybeSingle(),
    DB_TIMEOUT_MS,
    "booking detail",
  );
  if (error) throw new Error(`Failed to load booking: ${error.message}`);
  if (!data) return null;
  const r = data as unknown as Record<string, unknown>;
  if (r.customer_id !== auth.user.id && r.professional_id !== auth.user.id) return null;

  const viewerRole = r.professional_id === auth.user.id ? "professional" : "customer";
  // Has the viewer already reviewed (in their direction)? Has a tip been left?
  // Degrades to false if migrations 0020/0021 aren't applied. These three lookups
  // are independent → run them in parallel so the detail page isn't 3 serial hops.
  const dir = viewerRole === "professional" ? "pro_to_customer" : "customer_to_pro";
  const [rev, tip, pay, convo, change] = await withTimeout(
    Promise.all([
      supabase.from("reviews").select("id").eq("booking_id", id).eq("direction", dir).maybeSingle(),
      supabase.from("tips").select("id").eq("booking_id", id).maybeSingle(),
      supabase.from("payments").select("status").eq("booking_id", id).order("created_at", { ascending: false }).limit(1).maybeSingle(),
      supabase.from("conversations").select("id, is_unlocked").eq("booking_id", id).maybeSingle(),
      // Separate query on purpose: these columns arrive with 0036, and an error
      // here must degrade to "no reschedule UI", not break the whole page.
      supabase.from("bookings").select("change_requested_starts_at, change_requested_ends_at, change_requested_by, change_note").eq("id", id).maybeSingle(),
    ]),
    DB_TIMEOUT_MS,
    "booking detail extras",
  );
  const reviewedByViewer = Boolean(rev.data);
  const tipped = Boolean(tip.data);
  const convoRow = convo.data as { id?: string; is_unlocked?: boolean } | null;

  // Reschedule proposal — only meaningful while status = change_requested.
  const ch = (change.error ? null : change.data) as {
    change_requested_starts_at?: string | null;
    change_requested_ends_at?: string | null;
    change_requested_by?: string | null;
    change_note?: string | null;
  } | null;
  const proposedChange =
    String(r.status) === "change_requested" && ch?.change_requested_starts_at && ch?.change_requested_ends_at
      ? {
          startsAt: String(ch.change_requested_starts_at),
          endsAt: String(ch.change_requested_ends_at),
          note: ch.change_note ?? null,
          requestedByViewer: ch.change_requested_by === auth.user.id,
        }
      : null;

  // Payment status: prefer the payments row; fall back to booking-status-derived.
  let paymentStatus = "unpaid";
  const payStatus = (pay.data as { status?: string } | null)?.status;
  if (payStatus) paymentStatus = payStatus;
  else if (["confirmed", "in_progress", "completed"].includes(String(r.status))) paymentStatus = "paid";

  const pro = r.professional as { business_name?: string; slug?: string } | null;

  // C3: resolve the pro's address for THIS viewer. The professional party always
  // sees their own address; the customer only after confirmed + paid.
  const { parts, hideExactPin } = await withTimeout(
    fetchProAddress(supabase, String(r.professional_id)),
    DB_TIMEOUT_MS,
    "booking pro address",
  );
  const entitled = viewerRole === "professional" || addressUnlocked(String(r.status), paymentStatus);
  const professionalLocation = displayAddress(parts, {
    audience: entitled ? "booked" : "public",
    hideExactPin,
  });

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
    conversationId: convoRow?.id ?? null,
    messagingUnlocked: Boolean(convoRow?.is_unlocked),
    professionalLocation,
    proposedChange,
  };
}

export async function getMyProfessionalBookings(): Promise<BookingSummary[]> {
  if (!isLiveSupabase()) return [];
  const supabase = await createSupabaseServerClient();
  const { data: auth } = await withTimeout(supabase.auth.getUser(), DB_TIMEOUT_MS, "auth.getUser");
  if (!auth.user) return [];
  const { data, error } = await withTimeout(
    supabase.from("bookings").select(SELECT).eq("professional_id", auth.user.id).order("starts_at", { ascending: true }),
    DB_TIMEOUT_MS,
    "professional bookings",
  );
  if (error) throw new Error(`Failed to load bookings: ${error.message}`);
  return ((data as unknown as Record<string, unknown>[]) ?? []).map(mapRow);
}
