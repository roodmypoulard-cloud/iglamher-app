"use client";
import { useEffect } from "react";

// Registers the service worker (offline + Web Push) in production. No-ops in dev
// and where service workers aren't supported. Native Capacitor builds skip this
// (they use native push instead).
export function PWARegister() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const onLoad = () => navigator.serviceWorker.register("/sw.js").catch(() => {});
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
