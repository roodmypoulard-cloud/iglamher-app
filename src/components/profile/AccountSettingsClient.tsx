"use client";
import { useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/ui/Modal";
import { ModeSwitcher } from "@/components/profile/ModeSwitcher";
import { PhoneVerification } from "@/components/profile/PhoneVerification";
import { PaymentMethodsClient } from "@/components/payments/PaymentMethodsClient";
import {
  updatePersonalInfoAction, changeEmailAction, changePasswordAction,
  saveNotificationPrefsAction, saveLanguageAction, saveAppearanceAction, downloadMyDataAction,
  pauseAccountAction, deactivateAccountAction, reactivateAccountAction, deleteAccountAction,
  type SettingsState,
} from "@/lib/profile/settings-actions";
import { startProviderOnboardingAction } from "@/lib/pro/onboarding-actions";

type Provider = "email" | "google" | "apple";
type Props = {
  personal: { firstName: string; lastName: string; phone: string; email: string };
  phoneVerified: boolean;
  accountType: "customer" | "professional" | "both";
  activeMode: "customer" | "professional";
  accountStatus: "active" | "paused" | "deactivated";
  notif: { email: boolean; sms: boolean; push: boolean };
  appearance: "system" | "light" | "dark";
  language: string;
  providers: Provider[];
};

// ---- tiny inline icon set (premium, dependency-free) ----
const I = {
  user: "M12 12a5 5 0 1 0 0-10 5 5 0 0 0 0 10Zm-8 9a8 8 0 0 1 16 0",
  swap: "M7 4 3 8l4 4M3 8h14M17 20l4-4-4-4M21 16H7",
  briefcase: "M4 8h16v12H4zM9 8V5h6v3",
  card: "M2 6h20v12H2zM2 10h20",
  bell: "M6 9a6 6 0 1 1 12 0c0 5 2 6 2 6H4s2-1 2-6M10 21h4",
  shield: "M12 2 4 6v6c0 5 8 10 8 10s8-5 8-10V6l-8-4Z",
  power: "M12 3v9M6 6a8 8 0 1 0 12 0",
  life: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z",
  info: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 6v.5M12 11v6",
  trash: "M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13",
  globe: "M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20ZM2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20",
  moon: "M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8Z",
  chevron: "m9 6 6 6-6 6",
  check: "m5 12 5 5 9-9",
  download: "M12 3v12m0 0 4-4m-4 4-4-4M4 21h16",
};
function Icon({ d, className = "" }: { d: string; className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" className={className} width={18} height={18} aria-hidden>
      <path d={d} />
    </svg>
  );
}

function Card({ icon, title, children }: { icon: string; title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-[18px] border border-border bg-surface">
      <div className="flex items-center gap-2.5 border-b border-border/60 px-4 py-3">
        <span className="grid h-8 w-8 place-items-center rounded-full bg-rose/10 text-rose"><Icon d={icon} /></span>
        <h2 className="font-display text-[15px] font-semibold text-ink">{title}</h2>
      </div>
      <div className="divide-y divide-border/50">{children}</div>
    </section>
  );
}
function Row({ label, value, onClick, danger }: { label: string; value?: ReactNode; onClick?: () => void; danger?: boolean }) {
  const cls = `flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left transition-colors ${onClick ? "hover:bg-surface-hover" : ""}`;
  const inner = (
    <>
      <span className={`text-sm font-medium ${danger ? "text-danger" : "text-ink"}`}>{label}</span>
      <span className="flex items-center gap-2 text-sm text-ink-muted">
        {value}
        {onClick && <Icon d={I.chevron} className="text-ink-muted" />}
      </span>
    </>
  );
  return onClick ? <button type="button" className={cls} onClick={onClick}>{inner}</button> : <div className={cls}>{inner}</div>;
}
const input = "w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none";
function Msg({ s }: { s: SettingsState }) {
  if (!s) return null;
  if (s.error) return <p role="alert" className="mt-2 text-sm text-danger">{s.error}</p>;
  if (s.success) return <p className="mt-2 text-sm text-rose">{s.success}</p>;
  return null;
}

export function AccountSettingsClient(props: Props) {
  const router = useRouter();
  const [dialog, setDialog] = useState<null | string>(null);
  const [msg, setMsg] = useState<SettingsState>(undefined);
  const [notif, setNotif] = useState(props.notif);
  const [appearance, setAppearance] = useState(props.appearance);
  const [pending, start] = useTransition();
  const close = () => { setDialog(null); setMsg(undefined); };

  const runForm = (action: (p: SettingsState, fd: FormData) => Promise<SettingsState>) => (fd: FormData) =>
    start(async () => { const r = await action(undefined, fd); setMsg(r); if (r?.success) { router.refresh(); } });

  const runAction = (action: () => Promise<SettingsState>, closeAfter = true) =>
    start(async () => { const r = await action(); setMsg(r); if (r && !("error" in r && r.error)) { router.refresh(); if (closeAfter) setTimeout(close, 900); } });

  function applyAppearance(next: "system" | "light" | "dark") {
    setAppearance(next);
    try {
      localStorage.setItem("iglamher-theme", next);
      const dark = next === "dark" || (next === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
      document.documentElement.setAttribute("data-theme", dark ? "dark" : "light");
    } catch {}
    void saveAppearanceAction(next);
  }

  async function doDownload() {
    const r = await downloadMyDataAction();
    if (r.error || !r.data) { setMsg({ error: r.error ?? "Export failed." }); return; }
    const blob = new Blob([r.data], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "iglamher-my-data.json"; a.click();
    URL.revokeObjectURL(a.href);
  }

  const statusBadge = {
    active: <span className="rounded-full bg-success/15 px-2.5 py-1 text-[11px] font-bold text-success">● Active</span>,
    paused: <span className="rounded-full bg-warning/15 px-2.5 py-1 text-[11px] font-bold text-warning">❚❚ Paused</span>,
    deactivated: <span className="rounded-full bg-danger/15 px-2.5 py-1 text-[11px] font-bold text-danger">○ Deactivated</span>,
  }[props.accountStatus];

  const [delText, setDelText] = useState("");
  const [delPassword, setDelPassword] = useState("");

  return (
    <div className="space-y-4">
      {/* PERSONAL INFORMATION */}
      <Card icon={I.user} title="Personal Information">
        <Row label="Name" value={`${props.personal.firstName} ${props.personal.lastName}`.trim() || "—"} onClick={() => setDialog("personal")} />
        <Row label="Email" value={props.personal.email} onClick={() => setDialog("email")} />
        <Row
          label="Phone"
          value={
            props.personal.phone ? (
              <span className="flex items-center gap-1.5">
                {props.personal.phone}
                {props.phoneVerified && (
                  <span className="flex items-center gap-0.5 rounded-full bg-success/15 px-1.5 py-0.5 text-[10px] font-bold text-success">
                    <Icon d={I.check} className="h-3 w-3" /> Verified
                  </span>
                )}
              </span>
            ) : (
              "Add"
            )
          }
          onClick={() => setDialog("phone")}
        />
        <Row label="Password" value="••••••••" onClick={() => setDialog("password")} />
      </Card>

      {/* ACCOUNT MODE */}
      <Card icon={I.swap} title="Account Mode">
        {props.accountType === "customer" ? (
          <div className="px-4 py-3.5">
            <p className="mb-3 text-[13px] text-ink-muted">You currently use iGlamHer as a customer.</p>
            <button type="button" disabled={pending} onClick={() => start(async () => { const r = await startProviderOnboardingAction(); if (r?.error) setMsg({ error: r.error }); else router.push("/onboarding/professional"); })}
              className="rounded-full rose-gradient px-5 py-2.5 text-sm font-semibold text-[#2A1712] disabled:opacity-60">Become a beauty professional</button>
          </div>
        ) : (
          <div className="px-4 py-3.5">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-muted">Active mode</p>
            <ModeSwitcher activeMode={props.activeMode} />
          </div>
        )}
      </Card>

      {/* PROFESSIONAL PROFILE */}
      {props.accountType !== "customer" && (
        <Card icon={I.briefcase} title="Professional Profile">
          <Row label="Edit public profile & services" onClick={() => router.push("/pro/profile")} />
          <Row label="Onboarding & publish" onClick={() => router.push("/onboarding/professional")} />
        </Card>
      )}

      {/* PAYMENT METHODS */}
      <Card icon={I.card} title="Payment Methods">
        <div className="px-4 py-4">
          <p className="mb-3 text-[12px] text-ink-muted">Add one or more credit or debit cards. Cards are stored securely by Stripe and used to book and pay for services.</p>
          <PaymentMethodsClient />
        </div>
      </Card>

      {/* NOTIFICATIONS */}
      <Card icon={I.bell} title="Notifications">
        <form action={runForm(saveNotificationPrefsAction)} className="px-4 py-3.5">
          {(["email", "sms", "push"] as const).map((k) => (
            <label key={k} className="flex items-center justify-between py-2 text-sm">
              <span className="capitalize text-ink">{k === "sms" ? "SMS" : k} notifications</span>
              <input type="checkbox" name={k} checked={notif[k]} onChange={(e) => setNotif({ ...notif, [k]: e.target.checked })} className="h-5 w-5 accent-rose" />
            </label>
          ))}
          <button type="submit" disabled={pending} className="mt-2 rounded-full border border-rose px-4 py-2 text-sm font-semibold text-rose disabled:opacity-60">Save preferences</button>
        </form>
      </Card>

      {/* PRIVACY & SECURITY */}
      <Card icon={I.shield} title="Privacy & Security">
        <Row label="Two-Factor Authentication" value={<span className="rounded-full bg-border/60 px-2 py-0.5 text-[10px] font-semibold">Coming soon</span>} />
        <Row label="Download My Data" value={<Icon d={I.download} />} onClick={doDownload} />
        <div className="px-4 py-3.5">
          <p className="mb-2 text-[12px] font-semibold text-ink-muted">Connected accounts</p>
          <div className="flex flex-wrap gap-2">
            {(["email", "google", "apple"] as Provider[]).map((prov) => {
              const on = props.providers.includes(prov);
              return (
                <span key={prov} className={`flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-medium capitalize ${on ? "border-success/40 text-success" : "border-border text-ink-muted"}`}>
                  {on && <Icon d={I.check} className="h-3.5 w-3.5" />} {prov}
                </span>
              );
            })}
          </div>
        </div>
      </Card>

      {/* LANGUAGE + APPEARANCE */}
      <Card icon={I.globe} title="Language & Appearance">
        <div className="flex items-center justify-between px-4 py-3.5">
          <span className="text-sm font-medium text-ink">Language</span>
          <select defaultValue={props.language} onChange={(e) => start(async () => { const r = await saveLanguageAction(e.target.value); setMsg(r); })} className="rounded-[10px] border border-border bg-bg px-3 py-2 text-sm text-ink">
            <option value="en">English</option><option value="es">Español</option><option value="fr">Français</option><option value="ht">Kreyòl</option>
          </select>
        </div>
        <div className="px-4 py-3.5">
          <span className="mb-2 block text-sm font-medium text-ink">Appearance</span>
          <div className="flex gap-2 rounded-full border border-border bg-bg p-1">
            {(["system", "light", "dark"] as const).map((opt) => (
              <button key={opt} type="button" onClick={() => applyAppearance(opt)} aria-pressed={appearance === opt}
                className={`flex-1 rounded-full px-3 py-2 text-sm font-semibold capitalize transition ${appearance === opt ? "rose-gradient text-[#2A1712]" : "text-ink hover:text-rose"}`}>{opt}</button>
            ))}
          </div>
        </div>
      </Card>

      {/* ACCOUNT STATUS */}
      <Card icon={I.power} title="Account Status">
        <Row label="Current status" value={statusBadge} />
        {props.accountStatus === "active" && <Row label="Pause account (30 days)" onClick={() => setDialog("pause")} />}
        {props.accountStatus === "active" && <Row label="Deactivate account" onClick={() => setDialog("deactivate")} danger />}
        {props.accountStatus !== "active" && <Row label="Reactivate account" onClick={() => setDialog("reactivate")} />}
      </Card>

      {/* SUPPORT */}
      <Card icon={I.life} title="Support">
        <Row label="Help Center" onClick={() => router.push("/how-it-works")} />
        <Row label="Contact support" value="support@iglamher.com" />
      </Card>

      {/* ABOUT */}
      <Card icon={I.info} title="About">
        <Row label="Version" value="Beta 1.0" />
        <Link href="/legal/terms" className="block"><Row label="Terms of Service" onClick={() => {}} /></Link>
        <Link href="/legal/privacy" className="block"><Row label="Privacy Policy" onClick={() => {}} /></Link>
      </Card>

      {/* DANGER ZONE */}
      <section className="overflow-hidden rounded-[18px] border border-danger/40 bg-danger/5">
        <div className="flex items-center gap-2.5 border-b border-danger/20 px-4 py-3">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-danger/15 text-danger"><Icon d={I.trash} /></span>
          <h2 className="font-display text-[15px] font-semibold text-danger">Danger Zone</h2>
        </div>
        <Row label="Permanently delete account" onClick={() => setDialog("delete")} danger />
      </section>

      <Msg s={msg} />

      {/* ---------- DIALOGS ---------- */}
      <Modal open={dialog === "personal"} onClose={close} title="Edit personal information">
        <form action={runForm(updatePersonalInfoAction)} className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <input name="firstName" defaultValue={props.personal.firstName} placeholder="First name" required className={input} />
            <input name="lastName" defaultValue={props.personal.lastName} placeholder="Last name" required className={input} />
          </div>
          <p className="text-[12px] text-ink-muted">Your phone number is managed under Phone (with verification).</p>
          <Msg s={msg} />
          <button type="submit" disabled={pending} className="w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60">Save changes</button>
        </form>
      </Modal>

      <Modal open={dialog === "email"} onClose={close} title="Change email">
        <form action={runForm(changeEmailAction)} className="space-y-3">
          <input name="email" type="email" defaultValue={props.personal.email} required className={input} />
          <p className="text-[12px] text-ink-muted">We&apos;ll send a confirmation link to the new address.</p>
          <Msg s={msg} />
          <button type="submit" disabled={pending} className="w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60">Update email</button>
        </form>
      </Modal>

      <Modal open={dialog === "phone"} onClose={close} title={props.phoneVerified ? "Phone number" : "Verify phone number"}>
        <PhoneVerification initialPhone={props.personal.phone} verified={props.phoneVerified} onVerified={() => { router.refresh(); setTimeout(close, 1500); }} />
      </Modal>

      <Modal open={dialog === "password"} onClose={close} title="Change password">
        <form action={runForm(changePasswordAction)} className="space-y-3">
          <input name="password" type="password" placeholder="New password (8+ chars)" required className={input} />
          <input name="confirmPassword" type="password" placeholder="Confirm new password" required className={input} />
          <Msg s={msg} />
          <button type="submit" disabled={pending} className="w-full rounded-full rose-gradient py-3 text-sm font-semibold text-[#2A1712] disabled:opacity-60">Update password</button>
        </form>
      </Modal>

      <ConfirmDialog open={dialog === "pause"} onClose={close} title="Pause account for 30 days?" tone="yellow"
        body="Your profile is hidden from Discover, Search, and booking for 30 days. Existing bookings stay intact and you can reactivate anytime — it also reactivates automatically after 30 days."
        confirm="Pause account" pending={pending} onConfirm={() => runAction(pauseAccountAction)} msg={msg} />
      <ConfirmDialog open={dialog === "deactivate"} onClose={close} title="Deactivate account?" tone="orange"
        body="Your profile is hidden everywhere and you stop receiving bookings — with no automatic expiry. Your data is fully preserved and login stays available; press Reactivate anytime to return."
        confirm="Deactivate" pending={pending} onConfirm={() => runAction(deactivateAccountAction)} msg={msg} />
      <ConfirmDialog open={dialog === "reactivate"} onClose={close} title="Reactivate account?" tone="rose"
        body="Welcome back! This restores your profile and access immediately."
        confirm="Reactivate" pending={pending} onConfirm={() => runAction(reactivateAccountAction)} msg={msg} />

      <Modal open={dialog === "delete"} onClose={close} title="Permanently delete account">
        <div className="space-y-3">
          <p className="rounded-[10px] border border-danger/40 bg-danger/10 px-3 py-2.5 text-sm text-danger">
            This permanently removes your account and personal information. <strong>This action cannot be undone.</strong>
          </p>
          <p className="text-[13px] text-ink-muted">Your profile, portfolio, services, availability, favorites, and contact info are deleted. Financial records required by law are anonymized and retained.</p>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-muted">Confirm your password</label>
            <input type="password" value={delPassword} onChange={(e) => setDelPassword(e.target.value)} placeholder="Your password" className={input} />
          </div>
          <div>
            <label className="mb-1 block text-[12px] font-semibold text-ink-muted">Type DELETE to confirm</label>
            <input value={delText} onChange={(e) => setDelText(e.target.value)} placeholder="DELETE" className={input} />
          </div>
          <Msg s={msg} />
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={close} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink">Cancel</button>
            <button type="button" disabled={pending || delText !== "DELETE" || !delPassword}
              onClick={() => start(async () => { const r = await deleteAccountAction(delPassword, delText); setMsg(r ?? { error: "Deletion failed." }); })}
              className="flex-1 rounded-full bg-danger py-3 text-sm font-semibold text-white disabled:opacity-40">{pending ? "Deleting…" : "Delete forever"}</button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ConfirmDialog({ open, onClose, title, body, confirm, pending, onConfirm, tone = "rose", msg }: {
  open: boolean; onClose: () => void; title: string; body: string; confirm: string; pending: boolean; onConfirm: () => void; tone?: "rose" | "yellow" | "orange" | "red"; msg: SettingsState;
}) {
  const toneCls = {
    rose: "rose-gradient text-[#2A1712]",
    yellow: "bg-warning text-[#2A1712]",
    orange: "bg-[#E0873C] text-white",
    red: "bg-danger text-white",
  }[tone];
  return (
    <Modal open={open} onClose={onClose} title={title}>
      <p className="text-sm text-ink-muted">{body}</p>
      <Msg s={msg} />
      <div className="mt-4 flex gap-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-full border border-border py-3 text-sm font-semibold text-ink">Cancel</button>
        <button type="button" disabled={pending} onClick={onConfirm}
          className={`flex-1 rounded-full py-3 text-sm font-semibold disabled:opacity-60 ${toneCls}`}>{pending ? "Working…" : confirm}</button>
      </div>
    </Modal>
  );
}
