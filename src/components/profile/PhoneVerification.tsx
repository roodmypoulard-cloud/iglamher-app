"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  startPhoneVerificationAction, resendPhoneOtpAction, verifyPhoneOtpAction, type PhoneState,
} from "@/lib/profile/phone-actions";

const input = "w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none";
const btn = "w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] transition-transform active:scale-[0.98] disabled:opacity-60 disabled:active:scale-100";
const RESEND_SECONDS = 60;

// Common dial codes, US default. Value is the digits after the "+".
const COUNTRIES: { label: string; dial: string }[] = [
  { label: "🇺🇸 +1", dial: "1" },
  { label: "🇨🇦 +1", dial: "1" },
  { label: "🇬🇧 +44", dial: "44" },
  { label: "🇦🇺 +61", dial: "61" },
  { label: "🇮🇳 +91", dial: "91" },
  { label: "🇳🇬 +234", dial: "234" },
  { label: "🇭🇹 +509", dial: "509" },
  { label: "🇫🇷 +33", dial: "33" },
  { label: "🇩🇪 +49", dial: "49" },
  { label: "🇲🇽 +52", dial: "52" },
];

function Note({ s }: { s: PhoneState }) {
  if (!s) return null;
  if (s.error) return <p role="alert" className="mt-1 text-sm text-danger">{s.error}</p>;
  if (s.success) return <p className="mt-1 text-sm text-rose">{s.success}</p>;
  return null;
}

/** Two-step phone verification (Twilio Verify), rendered inside the Settings modal.
 *  Country selector (US default) + number → SMS code → verify. */
export function PhoneVerification({
  initialPhone, verified, onDone, onVerified,
}: { initialPhone: string; verified: boolean; onDone?: () => void; onVerified?: () => void }) {
  const router = useRouter();
  const [dialIdx, setDialIdx] = useState(0);
  const [phone, setPhone] = useState(initialPhone);
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [msg, setMsg] = useState<PhoneState>(undefined);
  const [pending, start] = useTransition();
  const [cooldown, setCooldown] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const codeRef = useRef<HTMLInputElement>(null);

  useEffect(() => () => { if (timer.current) clearInterval(timer.current); }, []);
  // Auto-focus the code field the moment we advance to the code step.
  useEffect(() => { if (step === "code") codeRef.current?.focus(); }, [step]);

  function beginCooldown() {
    setCooldown(RESEND_SECONDS);
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setCooldown((s) => { if (s <= 1 && timer.current) clearInterval(timer.current); return s - 1; });
    }, 1000);
  }

  function send(resend = false) {
    if (pending) return; // guard against double-taps issuing duplicate requests
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("dial", COUNTRIES[dialIdx].dial);
    start(async () => {
      const r = await (resend ? resendPhoneOtpAction : startPhoneVerificationAction)(undefined, fd);
      setMsg(r);
      if (r?.sent) { setStep("code"); beginCooldown(); }
    });
  }

  function verify() {
    if (pending) return;
    const fd = new FormData();
    fd.set("phone", phone);
    fd.set("dial", COUNTRIES[dialIdx].dial);
    fd.set("token", code);
    start(async () => {
      const r = await verifyPhoneOtpAction(undefined, fd);
      setMsg(r);
      if (r?.verified) { router.refresh(); (onDone ?? onVerified)?.(); }
    });
  }

  if (verified && step === "enter" && !msg) {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-[10px] border border-border bg-bg px-3.5 py-2.5">
          <span className="text-sm text-ink">{initialPhone}</span>
          <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success">✓ Verified</span>
        </div>
        <button type="button" onClick={() => { setStep("enter"); setMsg(undefined); }} className="text-sm text-rose hover:underline">
          Change number
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {step === "enter" ? (
        <form onSubmit={(e) => { e.preventDefault(); send(false); }} className="space-y-3">
          <div className="flex gap-2">
            <select
              aria-label="Country code"
              value={dialIdx}
              onChange={(e) => setDialIdx(Number(e.target.value))}
              className="rounded-[10px] border border-border bg-bg px-2.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none"
            >
              {COUNTRIES.map((c, i) => <option key={`${c.label}-${i}`} value={i}>{c.label}</option>)}
            </select>
            <input
              name="phone" type="tel" inputMode="tel" autoComplete="tel"
              value={phone} onChange={(e) => setPhone(e.target.value)}
              placeholder="(646) 724-4046" className={input} required autoFocus
            />
          </div>
          <p className="text-[12px] text-ink-muted">We&apos;ll text you a 6-digit code. Standard rates may apply.</p>
          <Note s={msg} />
          <button type="submit" disabled={pending} className={btn}>{pending ? "Sending code…" : "Send code"}</button>
        </form>
      ) : (
        <form onSubmit={(e) => { e.preventDefault(); verify(); }} className="space-y-3">
          <p className="text-[13px] text-ink-muted">Enter the code we texted to <span className="text-ink">{phone}</span>.</p>
          <input
            ref={codeRef}
            name="token" inputMode="numeric" autoComplete="one-time-code" pattern="\d{6}" maxLength={6}
            value={code} onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
            placeholder="123456" className={`${input} tracking-[0.4em] text-center`} required
          />
          <Note s={msg} />
          <button type="submit" disabled={pending || code.length !== 6} className={btn}>{pending ? "Verifying…" : "Verify"}</button>
          <div className="flex items-center justify-between text-sm">
            <button type="button" onClick={() => { setStep("enter"); setCode(""); setMsg(undefined); }} className="text-ink-muted hover:text-ink">
              ← Change number
            </button>
            <button
              type="button" disabled={cooldown > 0 || pending} onClick={() => send(true)}
              className="text-rose hover:underline disabled:text-ink-muted disabled:no-underline"
            >
              {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
