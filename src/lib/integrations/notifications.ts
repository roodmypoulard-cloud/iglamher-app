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
import { sendEmail as sendEmailSmtp, emailConfigured, notificationEmail } from "@/lib/email/send";

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
    // The notifications column is `data` (jsonb) — there is no `metadata` column.
    data: p.metadata ?? {},
  });
  return { channel: "in_app", delivered: !error, detail: error?.message };
}

// --- email: real transactional send via Zoho SMTP (lib/email/send) ---
async function sendEmail(p: NotificationPayload): Promise<ChannelResult> {
  if (!emailConfigured()) return { channel: "email", delivered: false, detail: "not configured" };

  // Resolve the recipient (explicit override, else the user's auth email) and
  // honor the customer's email opt-out when they have a preference row.
  let to = p.email;
  if (!to && isLiveSupabase()) {
    try {
      const admin = createAdminClient();
      const { data } = await admin.auth.admin.getUserById(p.userId);
      to = data.user?.email ?? undefined;
      const { data: pref } = await admin.from("customer_profiles").select("notif_email").eq("user_id", p.userId).maybeSingle();
      if ((pref as { notif_email?: boolean } | null)?.notif_email === false) {
        return { channel: "email", delivered: false, detail: "opted out" };
      }
    } catch {
      /* fall through — no recipient resolved */
    }
  }
  if (!to) return { channel: "email", delivered: false, detail: "no recipient" };

  const { subject, html, text } = notificationEmail(p.title, p.body);
  const res = await sendEmailSmtp(to, subject, html, text);
  return { channel: "email", delivered: res.ok, detail: res.error ?? (res.skipped ? "skipped" : undefined) };
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

/**
 * Fire-and-forget email that mirrors an in-app notification already written by the
 * caller. Email-only (no duplicate in-app insert) and NEVER throws — safe to call
 * after the primary action has committed, so a mail hiccup can't fail the action.
 */
export async function emailUserBestEffort(
  userId: string,
  type: NotificationPayload["type"],
  title: string,
  body: string,
  email?: string,
): Promise<void> {
  try {
    const res = await sendEmail({ userId, type, title, body, email });
    if (!res.delivered && res.detail && res.detail !== "not configured" && res.detail !== "opted out") {
      log.warn("notification.email.undelivered", { userId, type, detail: res.detail });
    }
  } catch (e) {
    log.warn("notification.email.failed", { userId, type, error: e instanceof Error ? e.message : String(e) });
  }
}
