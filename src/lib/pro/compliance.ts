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

/** Home-studio compliance questions. `required: true` questions that are
 *  answered "no" flag the profile for admin review (never auto-approved). */
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

/** True when a legally-required home-studio answer is "no" → needs admin review. */
export function homeStudioNeedsReview(answers: LocationCompliance): boolean {
  return HOME_STUDIO_QUESTIONS.some((q) => q.required && answers[q.key] === "no");
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
