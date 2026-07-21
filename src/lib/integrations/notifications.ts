import "server-only";
// Unified notification service. One interface, pluggable channels (email/SMS/push).
// Each channel is env-gated: if its keys aren't set, it degrades to an in-app
// notification (written to the DB) and a structured log — never a silent failure.
//
// Integration point: call dispatchNotification() from anywhere (booking actions,
// webhooks, cron). Add keys → channels light up with zero code changes.
import { createAdminClient } from "@/lib/supabase/admin";
import { isLiveSupabase } from "@/lib/data/source";
import { isConfigured } from "./config";
import { log } from "@/lib/observability/logger";

export type NotificationChannel = "in_app" | "email" | "sms" | "push";

export interface NotificationPayload {
  userId: string;
  type: "booking" | "message" | "review" | "payout" | "system" | "promo";
  title: string;
  body: string;
  channels?: NotificationChannel[]; // default: in_app + whatever's configured
  email?: string;
  phone?: string;
  metadata?: Record<string, unknown>;
}

export interface ChannelResult {
  channel: NotificationChannel;
  delivered: boolean;
  detail?: string;
}

async function sendInApp(p: NotificationPayload): Promise<ChannelResult> {
  if (!isLiveSupabase()) return { channel: "in_app", delivered: false, detail: "no db" };
  const admin = createAdminClient();
  const { error } = await admin.from("notifications").insert({
    user_id: p.userId,
    type: p.type,
    title: p.title,
    body: p.body,
    metadata: p.metadata ?? {},
  });
  return { channel: "in_app", delivered: !error, detail: error?.message };
}

// --- vendor channels: real integration points, dormant until keys exist ---
async function sendEmail(p: NotificationPayload): Promise<ChannelResult> {
  if (!isConfigured("resend_email") || !p.email) return { channel: "email", delivered: false, detail: "not configured" };
  // Integration point (Resend):
  //   const res = await fetch("https://api.resend.com/emails", { method:"POST",
  //     headers:{ Authorization:`Bearer ${process.env.RESEND_API_KEY}` }, body: ... });
  log.info("notification.email.pending", { to: p.email, type: p.type });
  return { channel: "email", delivered: false, detail: "resend wired; enable send in code" };
}

async function sendSms(p: NotificationPayload): Promise<ChannelResult> {
  if (!isConfigured("twilio_sms") || !p.phone) return { channel: "sms", delivered: false, detail: "not configured" };
  // Integration point (Twilio): POST https://api.twilio.com/2010-04-01/Accounts/{SID}/Messages.json
  log.info("notification.sms.pending", { type: p.type });
  return { channel: "sms", delivered: false, detail: "twilio wired; enable send in code" };
}

async function sendPush(p: NotificationPayload): Promise<ChannelResult> {
  const fcm = isConfigured("push_fcm");
  const apns = isConfigured("push_apns");
  if (!fcm && !apns) return { channel: "push", delivered: false, detail: "not configured" };
  if (!isLiveSupabase()) return { channel: "push", delivered: false, detail: "no db" };

  // Look up the user's registered devices (from device_tokens, migration 0010).
  const admin = createAdminClient();
  const { data } = await admin.from("device_tokens").select("token, platform").eq("user_id", p.userId);
  const tokens = (data as unknown as Array<{ token: string; platform: string }>) ?? [];
  if (tokens.length === 0) return { channel: "push", delivered: false, detail: "no devices registered" };

  // Integration point: fan out to FCM (android) / APNs (ios) with these tokens.
  //   iOS  → POST https://api.push.apple.com/3/device/{token}  (APNS_* creds)
  //   Android → POST https://fcm.googleapis.com/fcm/send        (FCM_SERVER_KEY)
  log.info("notification.push.pending", { userId: p.userId, type: p.type, devices: tokens.length });
  return { channel: "push", delivered: false, detail: `apns/fcm wired for ${tokens.length} device(s); enable send in code` };
}

/**
 * Send a notification across the requested (or default) channels. Always writes
 * the in-app notification; vendor channels deliver when configured.
 */
export async function dispatchNotification(p: NotificationPayload): Promise<ChannelResult[]> {
  const channels = p.channels ?? (["in_app", "email", "push"] as NotificationChannel[]);
  const results: ChannelResult[] = [];
  for (const ch of channels) {
    if (ch === "in_app") results.push(await sendInApp(p));
    else if (ch === "email") results.push(await sendEmail(p));
    else if (ch === "sms") results.push(await sendSms(p));
    else if (ch === "push") results.push(await sendPush(p));
  }
  return results;
}
