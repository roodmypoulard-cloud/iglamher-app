import "server-only";
// Direct Twilio Verify integration (no SDK — uses the REST API over fetch, so it
// runs on the Node.js server-action runtime with zero extra deps).
//
// Requires three server-only env vars (set in Vercel → Production):
//   TWILIO_ACCOUNT_SID       — starts with "AC…"
//   TWILIO_AUTH_TOKEN        — account auth token (SECRET, never sent to client)
//   TWILIO_VERIFY_SERVICE_SID — the Verify Service SID, starts with "VA…"
//
// We NEVER surface a raw Twilio error to the browser. Every failure is logged
// server-side (code + status + message) and mapped to a coarse, safe reason.

const BASE = "https://verify.twilio.com/v2";

export type SendReason =
  | "not_configured"
  | "invalid_number"
  | "max_attempts"
  | "rate_limited"
  | "undeliverable"
  | "error";

export type SendResult = { ok: true; status: string } | { ok: false; reason: SendReason };
export type CheckResult = { approved: boolean; reason?: "not_configured" | "invalid_number" | "expired" | "incorrect" | "error" };

/** True only when all three Twilio Verify env vars are present. */
export function twilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID &&
      process.env.TWILIO_AUTH_TOKEN &&
      process.env.TWILIO_VERIFY_SERVICE_SID,
  );
}

function authHeader(): string {
  const sid = process.env.TWILIO_ACCOUNT_SID as string;
  const token = process.env.TWILIO_AUTH_TOKEN as string;
  return "Basic " + Buffer.from(`${sid}:${token}`).toString("base64");
}

// Map Twilio Verify error codes → safe coarse reasons. Full detail is logged, not returned.
// https://www.twilio.com/docs/api/errors
function mapSendError(httpStatus: number, code?: number): SendReason {
  switch (code) {
    case 60200: // Invalid parameter (bad "To" number)
    case 60205: // SMS not supported by landline / carrier
    case 60033: // number not a valid mobile
    case 21211: // Invalid 'To' phone number
      return "invalid_number";
    case 60203: // Max send attempts reached for this number
      return "max_attempts";
    case 60212: // Too many concurrent requests for this number
    case 20429: // Too Many Requests
      return "rate_limited";
    case 60410: // Verification delivery attempt blocked
    case 30002: // account suspended / delivery blocked
    case 21608: // Trial account: destination number not verified (operator must upgrade/verify)
      return "undeliverable";
    default:
      return httpStatus === 429 ? "rate_limited" : "error";
  }
}

/** Send an SMS OTP via Twilio Verify. `to` must already be E.164 (+15551234567). */
export async function sendVerification(to: string): Promise<SendResult> {
  if (!twilioConfigured()) {
    console.error("[twilio.verify.send] BLOCKED: Twilio Verify env vars are not set", {
      hasAccountSid: Boolean(process.env.TWILIO_ACCOUNT_SID),
      hasAuthToken: Boolean(process.env.TWILIO_AUTH_TOKEN),
      hasServiceSid: Boolean(process.env.TWILIO_VERIFY_SERVICE_SID),
    });
    return { ok: false, reason: "not_configured" };
  }
  const svc = process.env.TWILIO_VERIFY_SERVICE_SID as string;
  try {
    const res = await fetch(`${BASE}/Services/${svc}/Verifications`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, Channel: "sms" }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as {
      status?: string;
      code?: number;
      message?: string;
      more_info?: string;
    };
    if (res.ok) return { ok: true, status: data.status ?? "pending" };
    // Log FULL detail server-side only — never returned to the client.
    console.error("[twilio.verify.send] failed", {
      httpStatus: res.status,
      code: data.code,
      message: data.message,
      moreInfo: data.more_info,
    });
    return { ok: false, reason: mapSendError(res.status, data.code) };
  } catch (e) {
    console.error("[twilio.verify.send] network error", e instanceof Error ? e.message : String(e));
    return { ok: false, reason: "error" };
  }
}

/** Check a user-entered 6-digit code against Twilio Verify. */
export async function checkVerification(to: string, code: string): Promise<CheckResult> {
  if (!twilioConfigured()) return { approved: false, reason: "not_configured" };
  const svc = process.env.TWILIO_VERIFY_SERVICE_SID as string;
  try {
    const res = await fetch(`${BASE}/Services/${svc}/VerificationCheck`, {
      method: "POST",
      headers: { Authorization: authHeader(), "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({ To: to, Code: code }),
      cache: "no-store",
    });
    const data = (await res.json().catch(() => ({}))) as { status?: string; code?: number; message?: string };
    if (res.ok && data.status === "approved") return { approved: true };
    if (!res.ok) {
      console.error("[twilio.verify.check] failed", { httpStatus: res.status, code: data.code, message: data.message });
      // 20404 = verification not found / already consumed / expired.
      if (data.code === 20404) return { approved: false, reason: "expired" };
      if (data.code === 60200) return { approved: false, reason: "invalid_number" };
      return { approved: false, reason: "error" };
    }
    // 200 but status "pending"/"canceled" → wrong code.
    return { approved: false, reason: data.status === "canceled" ? "expired" : "incorrect" };
  } catch (e) {
    console.error("[twilio.verify.check] network error", e instanceof Error ? e.message : String(e));
    return { approved: false, reason: "error" };
  }
}
