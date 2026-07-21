"use client";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/format";

function initialsOf(name?: string | null): string {
  if (!name) return "";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "";
  if (parts.length === 1) return parts[0]!.slice(0, 1).toUpperCase();
  return (parts[0]![0]! + parts[parts.length - 1]![0]!).toUpperCase();
}

/**
 * Production avatar with a graceful fallback chain:
 *   1. user photo (fades in smoothly once decoded)
 *   2. initials on a rose-gold gradient
 *   3. elegant crown-monogram placeholder
 * Thin rose-gold ring + soft shadow keep it on-brand across surfaces.
 */
export function Avatar({
  src,
  name,
  size = 40,
  className,
  priority = false,
}: {
  src?: string | null;
  name?: string | null;
  size?: number;
  className?: string;
  priority?: boolean;
}) {
  const [loaded, setLoaded] = useState(false);
  const [errored, setErrored] = useState(false);
  const showImage = Boolean(src) && !errored;
  const initials = initialsOf(name);

  return (
    <span
      style={{ height: size, width: size }}
      className={cn(
        "relative grid flex-none place-items-center overflow-hidden rounded-full",
        "ring-1 ring-gold/60 shadow-[0_4px_14px_rgba(0,0,0,0.35)]",
        // No-photo state is a round gold circle; a photo covers it once loaded.
        "bg-[linear-gradient(150deg,#E7C892,var(--color-gold))]",
        className,
      )}
    >
      {/* Fallback layer — sits under the photo so the fade reveals cleanly */}
      <span
        aria-hidden={showImage && loaded}
        className={cn(
          "absolute inset-0 grid place-items-center font-semibold text-[#2A1712]",
          "transition-opacity duration-300",
          showImage && loaded ? "opacity-0" : "opacity-100",
        )}
        style={{ fontSize: Math.round(size * 0.4) }}
      >
        {initials || (
          <svg viewBox="0 0 24 24" fill="none" width={size * 0.5} height={size * 0.5} aria-hidden>
            <path
              d="M5 9l2.5 2L12 6l4.5 5L19 9v6.5A1.5 1.5 0 0 1 17.5 17h-11A1.5 1.5 0 0 1 5 15.5V9Z"
              fill="currentColor"
              fillOpacity="0.85"
            />
          </svg>
        )}
      </span>

      {showImage && !loaded && <span aria-hidden className="absolute inset-0 shimmer rounded-full" />}
      {showImage && (
        <Image
          src={src as string}
          alt={name ? `${name}` : "Profile photo"}
          width={size}
          height={size}
          priority={priority}
          onLoad={() => setLoaded(true)}
          onError={() => setErrored(true)}
          className={cn(
            "img-luxe relative h-full w-full object-cover transition-opacity duration-500 ease-out",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </span>
  );
}
