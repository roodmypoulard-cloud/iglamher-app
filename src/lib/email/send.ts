import "server-only";
// SERVER-ONLY transactional email via Zoho SMTP. Credentials come from env and are
// NEVER exposed to the client. If SMTP isn't configured, sends are skipped (logged)
// so admin actions still succeed — email is best-effort, not a hard dependency.
import nodemailer from "nodemailer";

export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

let cached: nodemailer.Transporter | null = null;
function transport(): nodemailer.Transporter {
  if (cached) return cached;
  const port = Number(process.env.SMTP_PORT ?? 465);
  cached = nodemailer.createTransport({
    host: process.env.SMTP_HOST, // smtp.zoho.com
    port,
    secure: port === 465, // 465 = implicit TLS; 587 = STARTTLS
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
  return cached;
}

const FROM = `"iGlamHer" <${process.env.SMTP_USER ?? "support@iglamher.com"}>`;

/** Send an email. Returns ok:false (never throws) so callers can proceed regardless. */
export async function sendEmail(to: string, subject: string, html: string, text: string): Promise<{ ok: boolean; skipped?: boolean; error?: string }> {
  if (!emailConfigured()) {
    console.warn("[email] SMTP not configured — skipping send", { to, subject });
    return { ok: false, skipped: true };
  }
  if (!to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(to)) {
    return { ok: false, error: "invalid recipient" };
  }
  try {
    await transport().sendMail({ from: FROM, to, subject, html, text, replyTo: process.env.SMTP_USER });
    return { ok: true };
  } catch (e) {
    console.error("[email] send failed", e instanceof Error ? e.message : e);
    return { ok: false, error: "send failed" };
  }
}

// ---- Branded wrapper + status templates ------------------------------------

function wrap(title: string, bodyHtml: string): string {
  return `<!doctype html><html><body style="margin:0;background:#0B0909;font-family:Helvetica,Arial,sans-serif;color:#FFF8F4;">
  <div style="max-width:520px;margin:0 auto;padding:32px 24px;">
    <p style="font-size:22px;font-weight:700;letter-spacing:.02em;color:#D7A08F;margin:0 0 24px;">iGlamHer</p>
    <h1 style="font-size:20px;margin:0 0 16px;">${title}</h1>
    <div style="font-size:15px;line-height:1.6;color:#CDBEB7;">${bodyHtml}</div>
    <p style="margin-top:32px;font-size:12px;color:#998A83;">iGlamHer · Luxury beauty, on demand</p>
  </div></body></html>`;
}

export function approvedEmail(name: string): { subject: string; html: string; text: string } {
  const subject = "You're approved on iGlamHer 🎉";
  const html = wrap(
    "Welcome — you're approved!",
    `<p>Hi ${escapeHtml(name)},</p><p>Congratulations! Your iGlamHer professional profile has been reviewed and <strong>approved</strong>. You're now live in the marketplace and can receive bookings.</p>
     <p><a href="https://iglamher.com/pro/profile" style="display:inline-block;margin-top:8px;background:linear-gradient(180deg,#F0C0B4,#D7A08F);color:#2A1712;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">Go to your dashboard</a></p>`,
  );
  const text = `Hi ${name}, your iGlamHer professional profile has been approved. You're now live and can receive bookings. Manage it at https://iglamher.com/pro/profile`;
  return { subject, html, text };
}

export function rejectedEmail(name: string, reason: string): { subject: string; html: string; text: string } {
  const subject = "Update on your iGlamHer application";
  const html = wrap(
    "Your application wasn't approved",
    `<p>Hi ${escapeHtml(name)},</p><p>Thank you for applying to iGlamHer. After review, we're unable to approve your application at this time.</p>
     <p style="background:#181414;border:1px solid #3A2D29;border-radius:12px;padding:14px 16px;"><strong>Reason:</strong><br/>${escapeHtml(reason)}</p>
     <p>If you believe this was a mistake or your situation changes, you're welcome to reply to this email.</p>`,
  );
  const text = `Hi ${name}, after review we're unable to approve your iGlamHer application at this time.\n\nReason: ${reason}\n\nReply to this email if you have questions.`;
  return { subject, html, text };
}

export function needsInfoEmail(name: string, note: string, sections: string[]): { subject: string; html: string; text: string } {
  const subject = "We need a bit more info for your iGlamHer application";
  const list = sections.length ? `<p><strong>Please update:</strong> ${sections.map(escapeHtml).join(", ")}</p>` : "";
  const html = wrap(
    "A little more info needed",
    `<p>Hi ${escapeHtml(name)},</p><p>Thanks for applying! Before we can approve you, we need a few things updated:</p>
     <p style="background:#181414;border:1px solid #3A2D29;border-radius:12px;padding:14px 16px;">${escapeHtml(note)}</p>${list}
     <p><a href="https://iglamher.com/pro/application" style="display:inline-block;margin-top:8px;background:linear-gradient(180deg,#F0C0B4,#D7A08F);color:#2A1712;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">Update my application</a></p>`,
  );
  const text = `Hi ${name}, before we can approve your iGlamHer application we need a few updates:\n\n${note}\n${sections.length ? `\nPlease update: ${sections.join(", ")}\n` : ""}\nUpdate it at https://iglamher.com/pro/application`;
  return { subject, html, text };
}

/** Generic branded email mirroring an in-app notification (title + one-line body). */
export function notificationEmail(title: string, body: string): { subject: string; html: string; text: string } {
  const html = wrap(title, `<p>${escapeHtml(body)}</p>
    <p><a href="${escapeHtml(process.env.NEXT_PUBLIC_APP_URL ?? "https://iglamher.com")}/notifications" style="display:inline-block;margin-top:8px;background:linear-gradient(180deg,#F0C0B4,#D7A08F);color:#2A1712;text-decoration:none;font-weight:700;padding:12px 22px;border-radius:999px;">Open iGlamHer</a></p>`);
  return { subject: title, html, text: `${title}\n\n${body}` };
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);
}
