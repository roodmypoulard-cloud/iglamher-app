// Professional service-location compliance + legal agreements.
// Pure — safe to import from client or server. The legal wording lives here so
// acceptance records can pin an exact `version`; bump the version when wording
// changes and prior acceptances stay attributable to what was actually shown.

export const SERVICE_LOCATIONS = [
  { key: "home_studio", label: "My Home Studio", desc: "Clients travel to your approved home-based beauty studio." },
  { key: "client_location", label: "Client's Location", desc: "You travel to the client's home, hotel, office, venue, or production location." },
  { key: "salon_suite", label: "Salon or Salon Suite", desc: "You work from a licensed salon, salon suite, or shared beauty workspace." },
  { key: "commercial_studio", label: "Private Commercial Studio", desc: "You operate from a private commercial beauty studio." },
  { key: "multiple", label: "Multiple Locations", desc: "You provide services from more than one approved location." },
] as const;
export type ServiceLocationKey = (typeof SERVICE_LOCATIONS)[number]["key"];

/** Home-studio compliance questions. Every `required: true` question must be
 *  answered before the pro can continue (hard block). Answering one "no" does
 *  not block — it flags the profile for admin review (never auto-approved). */
export const HOME_STUDIO_QUESTIONS = [
  { key: "legally_permitted", label: "Is this location legally permitted to operate as a beauty-service business?", required: true },
  { key: "owner_permission", label: "Do you have permission from the property owner or landlord, if required?", required: true },
  { key: "zoning_health_safety", label: "Does the location comply with local zoning, health, safety, and licensing requirements?", required: true },
  { key: "in_hoa", label: "Is the location inside an HOA or managed property?", required: false },
  { key: "hoa_allows_visits", label: "If yes, do the property rules allow client visits?", required: false },
  { key: "home_salon_license", label: "Do you hold any required home-salon or establishment license?", required: false },
  { key: "liability_insurance", label: "Do you have professional liability insurance?", required: false },
  { key: "separate_workspace", label: "Do you have a separate, clean workspace for clients?", required: true },
  { key: "pets_away", label: "Are pets kept away from the service area during appointments?", required: false },
  { key: "restroom", label: "Is there a working restroom available for clients?", required: false },
  { key: "safe_entrance", label: "Is the location accessible by a safe and clearly identified entrance?", required: false },
] as const;
export type HomeStudioQuestionKey = (typeof HOME_STUDIO_QUESTIONS)[number]["key"];

export type YesNo = "yes" | "no";
export type LocationCompliance = Partial<Record<HomeStudioQuestionKey, YesNo>>;

/** True when the selected locations put the pro in a home-based setting, which
 *  is what makes the home-studio questions applicable at all. */
export function needsHomeStudioAnswers(locations: readonly string[]): boolean {
  return locations.includes("home_studio") || locations.includes("multiple");
}

export const REQUIRED_HOME_STUDIO_KEYS: HomeStudioQuestionKey[] = HOME_STUDIO_QUESTIONS.filter(
  (q) => q.required,
).map((q) => q.key);

/** Required questions still missing a yes/no. Empty = nothing left to answer.
 *  Unanswered is a HARD BLOCK — distinct from "no", which is a review flag. */
export function missingRequiredHomeStudioAnswers(answers: LocationCompliance): HomeStudioQuestionKey[] {
  return REQUIRED_HOME_STUDIO_KEYS.filter((k) => answers[k] !== "yes" && answers[k] !== "no");
}

/** True when every legally-required home-studio question has an explicit answer. */
export function requiredHomeStudioAnswered(answers: LocationCompliance): boolean {
  return missingRequiredHomeStudioAnswers(answers).length === 0;
}

/** True when a legally-required home-studio answer is "no" → needs admin review.
 *  Deliberately only reacts to an explicit "no": an unanswered question is not a
 *  review flag, it is a hard block handled by `requiredHomeStudioAnswered`. */
export function homeStudioNeedsReview(answers: LocationCompliance): boolean {
  return HOME_STUDIO_QUESTIONS.some((q) => q.required && answers[q.key] === "no");
}

// ---- Address privacy (Boss § Address Privacy) ------------------------------
// A pro's exact street address is never customer-visible before a booking is
// confirmed. Pre-booking customers see neighborhood/city only; the exact
// address unlocks once the booking is confirmed. Admins always see full.
export type AddressAudience = "public" | "booked" | "admin";

export const ADDRESS_PRIVACY_NOTE =
  "For safety, the exact address is shared once your booking is confirmed. Until then you'll see the general area.";

export interface AddressParts {
  addressLine1?: string | null;
  addressLine2?: string | null;
  neighborhood?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
}

/** What a given audience is allowed to see. `hideExactPin` only constrains the
 *  public (pre-booking) audience — admins and confirmed clients are unaffected. */
export function canSeeExactAddress(audience: AddressAudience, hideExactPin: boolean): boolean {
  if (audience === "admin" || audience === "booked") return true;
  return !hideExactPin;
}

/** Neighborhood-level label — never a street line, never a unit number. */
export function approximateAddress(a: AddressParts): string {
  const area = a.neighborhood?.trim() || a.city?.trim() || "";
  const region = a.state?.trim() || "";
  if (area && region) return `${area}, ${region}`;
  return area || region || "Area shared after booking";
}

/** Full street address for audiences entitled to it. */
export function exactAddress(a: AddressParts): string {
  return [
    [a.addressLine1?.trim(), a.addressLine2?.trim()].filter(Boolean).join(" "),
    a.neighborhood?.trim() && !a.city?.trim() ? a.neighborhood.trim() : null,
    [a.city?.trim(), a.state?.trim()].filter(Boolean).join(", "),
    a.postalCode?.trim(),
  ]
    .filter((s): s is string => Boolean(s && s.length))
    .join(", ");
}

/** Single entry point for rendering a pro's location to any audience. Returns
 *  the display string plus whether it was redacted, so UI copy can explain why
 *  instead of silently implying the street address is unknown. */
export function displayAddress(
  a: AddressParts,
  opts: { audience: AddressAudience; hideExactPin: boolean },
): { text: string; exact: boolean } {
  // `exact: true` promises the text contains the real street address, so it
  // requires a street line. City alone is approximate no matter who is asking —
  // otherwise a pro with no address on file would look like a disclosed one.
  if (a.addressLine1?.trim() && canSeeExactAddress(opts.audience, opts.hideExactPin)) {
    const full = exactAddress(a);
    if (full) return { text: full, exact: true };
  }
  return { text: approximateAddress(a), exact: false };
}

// ---- Legal agreements (versioned). The gold-standard shield: iGlamHer never ----
// grants permission to operate; the pro affirms they carry that responsibility.
export const PRO_AGREEMENTS = {
  license_responsibility: {
    version: "2026-07-24",
    text:
      "I confirm that I am responsible for obtaining and maintaining all licenses, permits, insurance, zoning approvals, establishment approvals, and other legal requirements needed to provide services at my selected location or locations.",
  },
  marketplace_disclaimer: {
    version: "2026-07-24",
    text:
      "I understand that iGlamHer is a marketplace and does not grant permission to operate a beauty business from a home, salon, studio, or client location.",
  },
} as const;
export type ProAgreementKey = keyof typeof PRO_AGREEMENTS;
export const PRO_AGREEMENT_KEYS = Object.keys(PRO_AGREEMENTS) as ProAgreementKey[];

// ---- Customer-facing product language (never claim legal authorization) ----
export const VERIFICATION_DISCLAIMER =
  "Verified documents indicate that iGlamHer reviewed the submitted information. Verification does not guarantee that the professional satisfies every law, regulation, permit, zoning requirement, or insurance obligation applicable to their business.";
export const PROFESSIONAL_RESPONSIBILITY_NOTE =
  "Professionals are responsible for maintaining all licenses, permits, approvals, and insurance required for their services and operating locations.";
