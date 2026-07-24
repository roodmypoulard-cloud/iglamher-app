import Link from "next/link";

/** iGlamHer Recommends feature panel (spec §7) — the page's hero trust moment.
 *  Deep black→warm-brown, fine rose-gold border, soft edge glow, and the three
 *  recommendation signals. Purely presentational; the recommended pros render
 *  in the shelf beside/under it. */
function Signal({ icon, label, sub }: { icon: React.ReactNode; label: string; sub: string }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid h-8 w-8 flex-none place-items-center rounded-full border border-gold/40 bg-black/30 text-gold">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[11.5px] font-bold leading-tight text-ink">{label}</span>
        <span className="block truncate text-[9.5px] text-ink-muted">{sub}</span>
      </span>
    </div>
  );
}

const ShieldCheck = () => (
  <svg viewBox="0 0 24 24" width={16} height={16} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 2 4 6v6c0 5 8 10 8 10s8-5 8-10V6l-8-4Z" /><path d="m9 12 2 2 4-4" /></svg>
);
const Star = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="currentColor" aria-hidden><path d="m12 2 2.9 6.3 6.9.8-5.1 4.7 1.4 6.8L12 17.2l-6.1 3.4 1.4-6.8L2.2 9.1l6.9-.8L12 2Z" /></svg>
);
const Flame = () => (
  <svg viewBox="0 0 24 24" width={15} height={15} fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="M12 3s5 3.5 5 8a5 5 0 0 1-10 0c0-1.2.5-2.3 1-3 .2 1 .8 1.8 1.7 2 .5-2.4-.2-4.8 2.3-7Z" /></svg>
);

export function RecommendsPanel() {
  return (
    <section className="relative overflow-hidden rounded-[20px] border border-rose/40 p-4"
      style={{ backgroundImage: "linear-gradient(150deg, #0B0909 0%, #1c1310 55%, #2a1c15 100%)" }}>
      {/* soft edge glow */}
      <span aria-hidden className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-gold/10 blur-3xl" />
      <p className="text-[9.5px] font-bold uppercase tracking-[0.2em] text-gold/90">Our top picks for you</p>
      <div className="mt-1 flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-1.5 font-display text-[22px] font-bold leading-none text-ink">
          iGlamHer Recommends
          <svg viewBox="0 0 24 24" width={16} height={16} fill="currentColor" className="text-gold" aria-hidden><path d="m12 3 1.4 4.1L17.5 8.5l-4.1 1.4L12 14l-1.4-4.1L6.5 8.5l4.1-1.4L12 3Z" /></svg>
        </h2>
        <Link href="/recommended" className="flex-none rounded-full border border-gold/50 px-3.5 py-1.5 text-[11.5px] font-bold text-gold transition-colors hover:bg-gold/10">
          View All
        </Link>
      </div>
      <p className="mt-1 text-[12px] text-ink-secondary">Handpicked professionals you&apos;ll love.</p>

      <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-white/5 pt-3.5">
        <Signal icon={<ShieldCheck />} label="Verified" sub="Gold Verified Badge" />
        <Signal icon={<Star />} label="Top Rated" sub="Loved by clients" />
        <Signal icon={<Flame />} label="Popular" sub="Trending now" />
      </div>
    </section>
  );
}
