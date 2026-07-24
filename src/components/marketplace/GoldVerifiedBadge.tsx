/** iGlamHer gold verification seal — shown ONLY for professionals who passed
 *  verification (pro.isVerified). A branded gold shield-check, never a generic
 *  blue tick. Tap/hover reveals "Verified by iGlamHer". */
export function GoldVerifiedBadge({ size = 15 }: { size?: number }) {
  return (
    <span
      className="inline-flex flex-none align-middle"
      role="img"
      aria-label="Verified by iGlamHer"
      title="Verified by iGlamHer — identity and professional information reviewed."
    >
      <svg viewBox="0 0 24 24" width={size} height={size} aria-hidden>
        <defs>
          <linearGradient id="ig-verif" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#f8ecab" />
            <stop offset="0.5" stopColor="#d9b45a" />
            <stop offset="1" stopColor="#9a7620" />
          </linearGradient>
        </defs>
        <path
          d="M12 1.6c1 .9 2.3 1.4 3.6 1.5l2.4.2.2 2.4c.1 1.3.6 2.6 1.5 3.6l1.6 1.8-1.6 1.8c-.9 1-1.4 2.3-1.5 3.6l-.2 2.4-2.4.2c-1.3.1-2.6.6-3.6 1.5L12 23.4l-1.8-1.6c-1-.9-2.3-1.4-3.6-1.5l-2.4-.2-.2-2.4c-.1-1.3-.6-2.6-1.5-3.6L1 12.1l1.6-1.8c.9-1 1.4-2.3 1.5-3.6l.2-2.4 2.4-.2c1.3-.1 2.6-.6 3.6-1.5L12 1.6Z"
          fill="url(#ig-verif)"
        />
        <path d="m8.2 12.2 2.5 2.5 5-5.2" fill="none" stroke="#2a1c08" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}
