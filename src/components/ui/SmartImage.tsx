"use client";
import Image, { type ImageProps } from "next/image";
import { useState } from "react";
import { cn } from "@/lib/format";

// Tiny espresso-toned blur placeholder (1x1 -> scaled), keeps CLS at zero.
export const BLUR_DATA_URL =
  "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMjExYjFhIi8+PC9zdmc+";

/**
 * next/image with a shimmer that fades out on load. Lazy by default (Next Image),
 * blur placeholder prevents layout shift, and the shimmer gives a smooth load-in.
 */
export function SmartImage({ className, alt, onLoad, ...props }: ImageProps) {
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      {!loaded && <span aria-hidden className="absolute inset-0 shimmer" />}
      <Image
        alt={alt}
        placeholder="blur"
        blurDataURL={BLUR_DATA_URL}
        onLoad={(e) => {
          setLoaded(true);
          onLoad?.(e);
        }}
        className={cn("transition-opacity duration-500", loaded ? "opacity-100" : "opacity-0", className)}
        {...props}
      />
    </>
  );
}
