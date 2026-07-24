/** iGlamHer gold seal — shown for professionals whose application an admin
 *  approved. A branded gold shield-check, never a generic blue tick.
 *
 *  C4: this seal means "application reviewed and approved by iGlamHer" and
 *  nothing more. It previously claimed "identity and professional information
 *  reviewed", which asserted specific credential checks the flag never proved.
 *  The specific, per-credential claims live in `TrustBadges` (ID Verified /
 *  License on File / Insurance on File / …), each from its own admin column. */
export function GoldVerifiedBadge({ size = 15 }: { size?: number }) {
  // One shared gradient id across every instance. Several badges render per page,
  // but the gradient is identical for all of them and uses objectBoundingBox
  // units, so it scales with `size` — whichever def the browser resolves first
  // paints the same fill. (A per-instance `useId` would force this leaf to
  // become a client component for no visual gain.)
  const gradientId = "ig-verif";
  return (
    <span
      className="inline-flex flex-none align-middle"
      role="img"
      aria-label="Approved by iGlamHer"
      title="Approved by iGlamHer — this professional's application was reviewed. See their profile for what was verified."
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8ecab" />
            <stop offset="0.5" stopColor="#d9b45a" />
            <stop offset="1" stopColor="#9a7620" />
          </linearGradient>
        </defs>
        <path
          d="M12 1.6c1 .9 2.3 1.4 3.6 1.5l2.4.2.2 2.4c.1 1.3.6 2.6 1.5 3.6l1.6 1.8-1.6 1.8c-.9 1-1.4 2.3-1.5 3.6l-.2 2.4-2.4.2c-1.3.1-2.6.6-3.6 1.5L12 23.4l-1.8-1.6c-1-.9-2.3-1.4-3.6-1.5l-2.4-.2-.2-2.4c-.1-1.3-.6-2.6-1.5-3.6L1 12.1l1.6-1.8c.9-1 1.4-2.3 1.5-3.6l.2-2.4 2.4-.2c1.3-.1 2.6-.6 3.6-1.5L12 1.6Z"
          fill={`url(#${gradientId})`}
        />
        <path d="m8.2 12.2 2.5 2.5 5-5.2" fill="none" stroke="#2a1c08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
