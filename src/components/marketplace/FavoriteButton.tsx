"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { HeartIcon } from "@/components/ui/icons";
import { cn } from "@/lib/format";
import { track } from "@/lib/analytics";
import { toggleFavoriteAction } from "@/lib/marketplace/favorites-actions";
import { useFavorites } from "@/lib/favorites/provider";
import { isLiveSupabase } from "@/lib/data/source";

export function FavoriteButton({
  professionalId,
  professionalSlug,
  initialFavorited = false,
  size = 34,
  variant = "chip",
}: {
  professionalId: string;
  professionalSlug: string;
  initialFavorited?: boolean;
  size?: number;
  variant?: "chip" | "inline";
}) {
  const router = useRouter();
  const { isFavorite, toggle, hydrated } = useFavorites();
  const [pending, startTransition] = useTransition();
  const [pop, setPop] = useState(false);
  const favorited = hydrated ? isFavorite(professionalId) : initialFavorited;

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const nowFavorited = toggle(professionalId); // optimistic local update
    if (nowFavorited) setPop(true); // fire the pop only on save, not un-save
    track(nowFavorited ? "favorite_added" : "favorite_removed", { professional: professionalSlug });

    // Persist to the server when a real DB is connected.
    if (isLiveSupabase()) {
      startTransition(async () => {
        const res = await toggleFavoriteAction(professionalId);
        if (!res.ok && res.needsAuth) {
          toggle(professionalId); // rollback local
          router.push(`/signin?next=${encodeURIComponent(`/professionals/${professionalSlug}`)}`);
        }
      });
    }
  }

  const label = favorited ? "Remove from favorites" : "Save to favorites";

  if (variant === "inline") {
    return (
      <button
        type="button"
        onClick={onClick}
        aria-pressed={favorited}
        aria-label={label}
        disabled={pending}
        className={cn(
          "inline-flex items-center gap-2 rounded-[12px] border px-4 py-3 text-sm font-semibold transition-colors",
          favorited ? "border-rose bg-rose/10 text-rose" : "border-border text-ink hover:bg-surface-hover",
        )}
      >
        <HeartIcon
          width={18}
          height={18}
          onAnimationEnd={() => setPop(false)}
          className={cn(favorited ? "fill-rose" : "", pop && "heart-pop")}
        />
        {favorited ? "Saved" : "Save"}
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={favorited}
      aria-label={label}
      disabled={pending}
      style={{ height: size, width: size }}
      className={cn(
        "grid flex-none place-items-center rounded-full transition-[transform,background,box-shadow] duration-200 active:scale-90",
        favorited ? "bg-rose text-[#2A1712] shadow-[0_0_16px_rgba(215,160,143,0.55)]" : "bg-bg-elevated/90 text-rose hover:bg-bg-elevated",
      )}
    >
      <HeartIcon
        width={16}
        height={16}
        onAnimationEnd={() => setPop(false)}
        className={cn(favorited ? "fill-current" : "", pop && "heart-pop")}
      />
    </button>
  );
}
