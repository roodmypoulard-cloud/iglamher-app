import { z } from "zod";

/** Customer Job Marketplace — shared domain types + validation. */

export const JOB_CATEGORIES = [
  { key: "makeup", label: "Makeup" },
  { key: "hair", label: "Hair" },
  { key: "nails", label: "Nails" },
  { key: "lashes", label: "Lashes" },
  { key: "bridal", label: "Bridal" },
  { key: "event", label: "Event" },
  { key: "house_call", label: "House Call" },
  { key: "custom", label: "Custom" },
] as const;

export type JobCategory = (typeof JOB_CATEGORIES)[number]["key"];
export const jobCategoryKeys = JOB_CATEGORIES.map((c) => c.key) as [JobCategory, ...JobCategory[]];

export const categoryLabel = (key: string) =>
  JOB_CATEGORIES.find((c) => c.key === key)?.label ?? "Custom";

export const TIME_WINDOWS = [
  { key: "morning", label: "Morning" },
  { key: "afternoon", label: "Afternoon" },
  { key: "evening", label: "Evening" },
  { key: "flexible", label: "I'm flexible" },
] as const;
export type TimeWindow = (typeof TIME_WINDOWS)[number]["key"];

export type JobRequestStatus = "open" | "matched" | "closed" | "cancelled" | "expired";

export type JobPhoto = { path: string; url: string };

export type JobRequest = {
  id: string;
  customerId: string;
  customerName: string;
  customerAvatarUrl: string | null;
  category: JobCategory;
  title: string;
  description: string;
  photos: JobPhoto[];
  preferredDate: string | null; // ISO date
  timeWindow: TimeWindow | null;
  locationText: string;
  isHouseCall: boolean;
  budgetCents: number | null;
  status: JobRequestStatus;
  createdAt: string; // ISO timestamp
};

export const MAX_INSPO_PHOTOS = 4;
export const INSPO_MIMES = ["image/jpeg", "image/png", "image/webp"] as const;
export const INSPO_MAX_BYTES = 8 * 1024 * 1024;

export const createJobRequestSchema = z.object({
  category: z.enum(jobCategoryKeys),
  title: z.string().trim().min(3, "Give your request a short title").max(80),
  description: z.string().trim().min(10, "Describe what you need (at least 10 characters)").max(2000),
  preferredDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Pick a date")
    .nullable(),
  timeWindow: z.enum(["morning", "afternoon", "evening", "flexible"]).nullable(),
  locationText: z.string().trim().min(2, "Where should this happen?").max(120),
  isHouseCall: z.boolean(),
  /** Whole dollars from the form; converted to cents server-side. */
  budgetDollars: z
    .number()
    .int("Whole dollars only")
    .min(1, "Budget must be at least $1")
    .max(10000, "Budget can be at most $10,000")
    .nullable(),
  photos: z
    .array(z.object({ path: z.string().min(1), url: z.string().url() }))
    .max(MAX_INSPO_PHOTOS)
    .default([]),
});

export type CreateJobRequestInput = z.infer<typeof createJobRequestSchema>;

/** "2h ago" / "3d ago" style stamp for feed cards. */
export function timeAgo(iso: string, now = Date.now()): string {
  const s = Math.max(0, Math.floor((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return "Just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return `${d}d ago`;
  const w = Math.floor(d / 7);
  return w < 5 ? `${w}w ago` : new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
