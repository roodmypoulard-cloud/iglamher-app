import { z } from "zod";

export const CATEGORY_ENUM = z.enum(["hair", "makeup", "lashes", "nails", "stylist"]);
export const LOCATION_ENUM = z.enum(["mobile", "in_salon", "both"]);

export const serviceSchema = z.object({
  name: z.string().trim().min(2, "Name is too short").max(80),
  category: CATEGORY_ENUM,
  description: z.string().trim().max(600).optional().or(z.literal("")),
  // Price entered in dollars; validated then converted to integer cents server-side.
  priceDollars: z.coerce.number().min(0, "Price cannot be negative").max(100000),
  priceIsFrom: z.coerce.boolean().optional().default(false),
  durationMin: z.coerce.number().int("Duration must be whole minutes").min(1, "Duration must be positive").max(1440),
  locationType: LOCATION_ENUM,
  bufferBeforeMin: z.coerce.number().int().min(0).max(240, "Buffer is unreasonably long"),
  bufferAfterMin: z.coerce.number().int().min(0).max(240, "Buffer is unreasonably long"),
  depositPercent: z.coerce.number().int().min(0).max(100).optional().default(20),
  travelFeeDollars: z.coerce.number().min(0).max(100000).optional(),
  instantBook: z.coerce.boolean().optional().default(false),
  isActive: z.coerce.boolean().optional().default(true),
});
export type ServiceInput = z.infer<typeof serviceSchema>;

const windowSchema = z
  .object({
    weekday: z.coerce.number().int().min(0).max(6),
    startMinute: z.coerce.number().int().min(0).max(1440),
    endMinute: z.coerce.number().int().min(0).max(1440),
  })
  .refine((w) => w.endMinute > w.startMinute, { message: "End time must be after start time" });

export const availabilitySchema = z.object({
  timezone: z.string().min(1),
  minNoticeMinutes: z.coerce.number().int().min(0).max(20160),
  maxWindowDays: z.coerce.number().int().min(1).max(365),
  windows: z.array(windowSchema).max(21), // up to 3 windows/day
});
export type AvailabilityInput = z.infer<typeof availabilitySchema>;

export const profileSchema = z.object({
  businessName: z.string().trim().min(2).max(80),
  primarySpecialty: z.string().trim().min(2).max(80),
  headline: z.string().trim().max(120).optional().or(z.literal("")),
  bio: z.string().trim().max(1200).optional().or(z.literal("")),
  city: z.string().trim().max(80).optional().or(z.literal("")),
  postalCode: z.string().trim().max(12).optional().or(z.literal("")),
  yearsExperience: z.coerce.number().int().min(0).max(70).optional(),
  locationType: LOCATION_ENUM,
  serviceRadiusMiles: z.coerce.number().min(0).max(200).optional(),
  languages: z.string().trim().max(200).optional().or(z.literal("")), // comma-separated
  specialties: z.string().trim().max(300).optional().or(z.literal("")), // comma-separated
  instagramHandle: z.string().trim().max(40).optional().or(z.literal("")),
  cancellationPolicy: z.string().trim().max(600).optional().or(z.literal("")),
});
export type ProfileInput = z.infer<typeof profileSchema>;

/** Upload guardrails for portfolio media (mirrors Storage policy). */
export const UPLOAD_LIMITS = {
  maxBytes: 8 * 1024 * 1024, // 8 MB
  mimes: ["image/jpeg", "image/png", "image/webp", "image/avif"],
} as const;

export function safeFilename(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9.]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "upload";
}
