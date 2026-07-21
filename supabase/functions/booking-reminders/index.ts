// Supabase Edge Function — booking reminders (24h + 2h before appointment).
// Deploy: supabase functions deploy booking-reminders
// Schedule via pg_cron + pg_net, or Supabase scheduled functions:
//   select cron.schedule('booking-reminders','*/15 * * * *',
//     $$ select net.http_post('https://<proj>.functions.supabase.co/booking-reminders',
//        headers:=jsonb_build_object('Authorization','Bearer <service_role>')) $$);
//
// Sends in-app notifications now; wire push (APNs/FCM) where marked once configured.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async () => {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    { auth: { persistSession: false } },
  );

  const now = new Date();
  const windows = [
    { hours: 24, kind: "reminder_24h" },
    { hours: 2, kind: "reminder_2h" },
  ];

  let sent = 0;
  for (const w of windows) {
    const from = new Date(now.getTime() + (w.hours * 60 - 15) * 60_000).toISOString();
    const to = new Date(now.getTime() + w.hours * 60 * 60_000).toISOString();
    const { data: bookings } = await supabase
      .from("bookings")
      .select("id, customer_id, professional_id, service_name_snapshot, starts_at")
      .eq("status", "confirmed")
      .gte("starts_at", from)
      .lt("starts_at", to);

    for (const b of bookings ?? []) {
      await supabase.from("notifications").insert({
        user_id: b.customer_id,
        type: "booking",
        title: `Reminder: ${b.service_name_snapshot}`,
        body: `Your appointment is in ${w.hours} hours.`,
        metadata: { booking_id: b.id, kind: w.kind },
      });
      // TODO(push): dispatch APNs/FCM here once device tokens + certs exist.
      sent++;
    }
  }

  return new Response(JSON.stringify({ ok: true, sent }), { headers: { "content-type": "application/json" } });
});
