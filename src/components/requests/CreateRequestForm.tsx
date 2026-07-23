"use client";
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { SmartImage } from "@/components/ui/SmartImage";
import { createJobRequestAction, uploadInspoPhotoAction } from "@/lib/requests/actions";
import {
  JOB_CATEGORIES, TIME_WINDOWS, MAX_INSPO_PHOTOS,
  type JobCategory, type JobPhoto, type TimeWindow,
} from "@/lib/requests/schema";
import { cn } from "@/lib/format";

const input = "w-full rounded-[10px] border border-border bg-bg px-3.5 py-2.5 text-sm text-ink focus:border-rose focus:outline-none";
const label = "mb-1.5 block text-[12.5px] font-semibold text-ink-secondary";

export function CreateRequestForm() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const [pending, start] = useTransition();
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [category, setCategory] = useState<JobCategory | null>(null);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [photos, setPhotos] = useState<JobPhoto[]>([]);
  const [preferredDate, setPreferredDate] = useState("");
  const [timeWindow, setTimeWindow] = useState<TimeWindow | null>(null);
  const [locationText, setLocationText] = useState("");
  const [isHouseCall, setIsHouseCall] = useState(false);
  const [budget, setBudget] = useState("");

  const today = new Date().toISOString().slice(0, 10);

  async function onPickPhotos(files: FileList | null) {
    if (!files?.length) return;
    setError(null);
    setUploading(true);
    try {
      for (const file of Array.from(files).slice(0, MAX_INSPO_PHOTOS - photos.length)) {
        const fd = new FormData();
        fd.set("file", file);
        const res = await uploadInspoPhotoAction(fd);
        if (!res.ok) { setError(res.error); break; }
        if (res.data) setPhotos((p) => [...p, res.data as JobPhoto]);
      }
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  }

  function submit() {
    setError(null);
    if (!category) { setError("Pick a category."); return; }
    start(async () => {
      const res = await createJobRequestAction({
        category,
        title,
        description,
        photos,
        preferredDate: preferredDate || null,
        timeWindow,
        locationText,
        isHouseCall: isHouseCall || category === "house_call",
        budgetDollars: budget ? Number(budget) : null,
      });
      if (!res.ok) { setError(res.error); return; }
      router.push(`/requests/${res.data?.id}`);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {/* Category */}
      <section>
        <span className={label}>What do you need?</span>
        <div role="radiogroup" aria-label="Category" className="grid grid-cols-4 gap-1.5">
          {JOB_CATEGORIES.map((c) => (
            <button
              key={c.key}
              type="button"
              role="radio"
              aria-checked={category === c.key}
              onClick={() => setCategory(c.key)}
              className={cn(
                "min-h-[40px] rounded-[12px] border px-1 text-[12px] font-semibold transition-colors duration-150",
                category === c.key
                  ? "border-rose/60 bg-rose/[0.12] text-rose"
                  : "border-border bg-surface text-ink-secondary hover:border-rose/40",
              )}
            >
              {c.label}
            </button>
          ))}
        </div>
      </section>

      {/* Title + description */}
      <section>
        <label className={label} htmlFor="jr-title">Title</label>
        <input
          id="jr-title" value={title} maxLength={80}
          onChange={(e) => setTitle(e.target.value)}
          className={input} placeholder="e.g. Soft glam makeup for a wedding guest"
        />
      </section>
      <section>
        <label className={label} htmlFor="jr-desc">Describe it</label>
        <textarea
          id="jr-desc" value={description} maxLength={2000} rows={4}
          onChange={(e) => setDescription(e.target.value)}
          className={cn(input, "resize-none leading-relaxed")}
          placeholder="Share the look you're going for, hair type / skin tone if relevant, timing, and anything a pro should know."
        />
      </section>

      {/* Inspiration photos */}
      <section>
        <span className={label}>Inspiration photos <span className="font-normal text-ink-muted">(optional, up to {MAX_INSPO_PHOTOS})</span></span>
        <div className="flex flex-wrap gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative h-[72px] w-[72px]">
              <SmartImage src={p.url} alt="Inspiration" width={72} height={72} className="h-full w-full rounded-[12px] object-cover" />
              <button
                type="button"
                aria-label="Remove photo"
                onClick={() => setPhotos((cur) => cur.filter((x) => x.path !== p.path))}
                className="absolute -right-1.5 -top-1.5 grid h-6 w-6 place-items-center rounded-full border border-border bg-bg-elevated text-ink-secondary shadow-sm"
              >
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none" aria-hidden><path d="m6 6 12 12M18 6 6 18" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" /></svg>
              </button>
            </div>
          ))}
          {photos.length < MAX_INSPO_PHOTOS && (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
              className="grid h-[72px] w-[72px] place-items-center rounded-[12px] border border-dashed border-border text-ink-muted transition-colors hover:border-rose/50 hover:text-rose disabled:opacity-60"
              aria-label="Add inspiration photo"
            >
              {uploading ? (
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-rose border-t-transparent" aria-hidden />
              ) : (
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" aria-hidden><path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" /></svg>
              )}
            </button>
          )}
        </div>
        <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(e) => onPickPhotos(e.target.files)} />
      </section>

      {/* Date + time window */}
      <div className="grid grid-cols-2 gap-2.5">
        <section>
          <label className={label} htmlFor="jr-date">Preferred date <span className="font-normal text-ink-muted">(optional)</span></label>
          <input id="jr-date" type="date" min={today} value={preferredDate} onChange={(e) => setPreferredDate(e.target.value)} className={input} />
        </section>
        <section>
          <label className={label} htmlFor="jr-time">Time of day</label>
          <select id="jr-time" value={timeWindow ?? ""} onChange={(e) => setTimeWindow((e.target.value || null) as TimeWindow | null)} className={input}>
            <option value="">Any</option>
            {TIME_WINDOWS.map((t) => <option key={t.key} value={t.key}>{t.label}</option>)}
          </select>
        </section>
      </div>

      {/* Location + house call */}
      <section>
        <label className={label} htmlFor="jr-loc">Location</label>
        <input id="jr-loc" value={locationText} maxLength={120} onChange={(e) => setLocationText(e.target.value)} className={input} placeholder="Neighborhood or city, e.g. West Hollywood" />
        <label className="mt-2 flex min-h-[40px] cursor-pointer items-center gap-2.5 text-[13px] text-ink-secondary">
          <input type="checkbox" checked={isHouseCall || category === "house_call"} onChange={(e) => setIsHouseCall(e.target.checked)} className="h-4 w-4 accent-[var(--color-rose)]" />
          The pro comes to me (house call)
        </label>
      </section>

      {/* Budget */}
      <section>
        <label className={label} htmlFor="jr-budget">Budget <span className="font-normal text-ink-muted">(optional)</span></label>
        <div className="relative">
          <span aria-hidden className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm text-ink-muted">$</span>
          <input
            id="jr-budget" inputMode="numeric" value={budget}
            onChange={(e) => setBudget(e.target.value.replace(/\D/g, "").slice(0, 5))}
            className={cn(input, "pl-7")} placeholder="150"
          />
        </div>
      </section>

      {error && <p role="alert" className="text-[13px] text-danger">{error}</p>}

      <button
        type="button"
        onClick={submit}
        disabled={pending || uploading}
        className="w-full rounded-full rose-gradient py-3.5 text-[15px] font-bold text-[#2A1712] transition-transform active:scale-[0.98] disabled:opacity-60"
      >
        {pending ? "Posting…" : "Post request"}
      </button>
      <p className="pb-2 text-center text-[11.5px] leading-snug text-ink-muted">
        Your request is visible to iGlamHer members and beauty professionals. No exact address is shared.
      </p>
    </div>
  );
}
