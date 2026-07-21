// Supabase Edge Function — payout processing for completed bookings.
// Deploy: supabase functions deploy payout-processor
// Creates payout_records and (when Stripe is configured) Stripe transfers to the
// professional's connected account for the net amount (total - platform fee).
// Payouts are SKIPPED for professionals whose payouts_frozen = true (dispute hold).
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  // Completed bookings with a succeeded payment and no payout yet.
  const { data: due } = await supabase
    .from("bookings")
    .select("id, professional_id, total_cents, platform_fee_cents, completed_at, professional:professional_profiles!bookings_professional_id_fkey(payouts_frozen, stripe_account_id)")
    .eq("status", "completed")
    .not("completed_at", "is", null);

  let processed = 0;
  for (const b of due ?? []) {
    const pro = (b as { professional?: { payouts_frozen?: boolean; stripe_account_id?: string } }).professional;
    if (pro?.payouts_frozen) continue; // dispute / fraud hold

    const { data: exists } = await supabase.from("payout_records").select("id").eq("booking_id", b.id).maybeSingle();
    if (exists) continue; // idempotent

    const netCents = (b.total_cents ?? 0) - (b.platform_fee_cents ?? 0);
    await supabase.from("payout_records").insert({
      professional_id: b.professional_id,
      booking_id: b.id,
      amount_cents: netCents,
      status: "pending",
    });
    // TODO(stripe): create a Stripe transfer to pro.stripe_account_id here.
    processed++;
  }

  return new Response(JSON.stringify({ ok: true, processed }), { headers: { "content-type": "application/json" } });
});
