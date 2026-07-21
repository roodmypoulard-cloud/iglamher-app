"use client";
import { useState, useEffect, useTransition } from "react";
import { useRouter } from "next/navigation";
import { sendPhoneOtpAction, verifyPhoneOtpAction } from "@/lib/profile/phone-actions";

// Small set of dial codes (E.164). Extend as needed.
const COUNTRIES = [
  { code: "US", label: "United States", dial: "+1", flag: "🇺🇸" },
  { code: "CA", label: "Canada", dial: "+1", flag: "🇨🇦" },
  { code: "HT", label: "Haiti", dial: "+509", flag: "🇭🇹" },
  { code: "DO", label: "Dominican Republic", dial: "+1", flag: "🇩🇴" },
  { code: "FR", label: "France", dial: "+33", flag: "🇫🇷" },
  { code: "GB", label: "United Kingdom", dial: "+44", flag: "🇬🇧" },
  { code: "JM", label: "Jamaica", dial: "+1", flag: "🇯🇲" },
  { code: "MX", label: "Mexico", dial: "+52", flag: "🇲🇽" },
] as const;

const RESEND_SECONDS = 45;
const input = "w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none";

/** Add/verify a phone number via Supabase OTP. `verified` reflects the confirmed
 *  state; the number is only shown as verified after a correct code is entered. */
export function PhoneVerification({
  initialPhone,
  verified,
  onDone,
}: {
  initialPhone: string;
  verified: boolean;
  onDone?: () => void;
}) {
  const [step, setStep] = useState<"enter" | "code">("enter");
  const [dial, setDial] = useState<string>(COUNTRIES[0].dial);
  const [national, setNational] = useState<string>("");
  const [e164, setE164] = useState<string>("");
  const [code, setCode] = useState<string>("");
  const [msg, setMsg] = useState<{ error?: string; success?: string } | null>(null);
  const [isVerified, setIsVerified] = useState<boolean>(verified);
  const [cooldown, setCooldown] = useState<number>(0);
  const [pending, start] = useTransition();
  const router = useRouter();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown((c) => (c <= 1 ? 0 : c - 1)), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  const buildE164 = () => `${dial}${national.replace(/\D/g, "")}`;

  const send = (resending = false) => {
    const phone = e164 || buildE164();
    start(async () => {
      setMsg(null);
      const res = await sendPhoneOtpAction(phone);
      setMsg(res ?? null);
      if (res?.success) {
        setE164(phone);
        setStep("code");
        setCooldown(RESEND_SECONDS);
        if (resending) setMsg({ success: "A new code is on its way." });
      }
    });
  };

  const verify = () => {
    start(async () => {
      setMsg(null);
      const res = await verifyPhoneOtpAction(e164, code);
      setMsg(res ?? null);
      if (res?.verified) {
        setIsVerified(true);
        router.refresh();
        onDone?.();
      }
    });
  };

  if (isVerified && step === "enter") {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between rounded-[10px] border border-success/30 bg-success/10 px-3.5 py-2.5">
          <span className="text-sm text-ink">{initialPhone || e164}</span>
          <span className="flex items-center gap-1 text-[12px] font-semibold text-success">
            <svg viewBox="0 0 24 24" width={14} height={14} fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="m5 12 5 5 9-9" /></svg>
            Verified
          </span>
        </div>
        <button type="button" onClick={() => { setIsVerified(false); setNational(""); setMsg(null); }} className="text-sm font-semibold text-rose hover:underline">
          Change number
        </button>
      </div>
    );
  }

  if (step === "enter") {
    return (
      <div className="space-y-3">
        <label className="block text-[12px] font-semibold text-ink-muted">Phone number</label>
        <div className="flex gap-2">
          <select value={dial} onChange={(e) => setDial(e.target.value)} className="rounded-[10px] border border-border bg-bg px-2 py-2.5 text-sm text-ink" aria-label="Country code">
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.dial}>{c.flag} {c.dial}</option>
            ))}
          </select>
          <input
            type="tel"
            inputMode="tel"
            value={national}
            onChange={(e) => setNational(e.target.value)}
            placeholder="555 123 4567"
            className={input}
          />
        </div>
        <p className="text-[11px] text-ink-muted">We&apos;ll text you a 6-digit code to confirm this number.</p>
        {msg?.error && <p role="alert" className="text-sm text-danger">{msg.error}</p>}
        <button
          type="button"
          disabled={pending || national.replace(/\D/g, "").length < 6}
          onClick={() => send(false)}
          className="w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60"
        >
          {pending ? "Sending…" : "Send code"}
        </button>
      </div>
    );
  }

  // step === "code"
  return (
    <div className="space-y-3">
      <p className="text-sm text-ink-muted">Enter the 6-digit code sent to <span className="font-semibold text-ink">{e164}</span>.</p>
      <input
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={6}
        value={code}
        onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
        placeholder="123456"
        className={`${input} text-center text-lg tracking-[0.4em]`}
      />
      {msg?.error && <p role="alert" className="text-sm text-danger">{msg.error}</p>}
      {msg?.success && <p className="text-sm text-rose">{msg.success}</p>}
      <button
        type="button"
        disabled={pending || code.length !== 6}
        onClick={verify}
        className="w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60"
      >
        {pending ? "Verifying…" : "Verify"}
      </button>
      <div className="flex items-center justify-between text-[13px]">
        <button type="button" onClick={() => { setStep("enter"); setMsg(null); }} className="text-ink-muted hover:text-ink">
          ← Change number
        </button>
        <button
          type="button"
          disabled={pending || cooldown > 0}
          onClick={() => send(true)}
          className="font-semibold text-rose disabled:text-ink-muted"
        >
          {cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
        </button>
      </div>
    </div>
  );
}
