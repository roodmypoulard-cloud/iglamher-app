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
