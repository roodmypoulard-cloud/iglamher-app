/* iGlamHer service worker — conservative offline support.
 * Pages: network-first (always fresh online, offline fallback).
 * Images: stale-while-revalidate. Static build assets: cache-first.
 * Never caches API routes, auth, checkout, or webhooks. */
const VERSION = "iglamher-v1";
const SHELL = `${VERSION}-shell`;
const IMAGES = `${VERSION}-img`;
const OFFLINE_URL = "/offline";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(SHELL).then((c) => c.addAll([OFFLINE_URL, "/brand/logo-word.png"])).then(() => self.skipWaiting()));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(keys.filter((k) => !k.startsWith(VERSION)).map((k) => caches.delete(k)))).then(() => self.clients.claim()),
  );
});

const isImage = (url) => /\.(png|jpe?g|webp|avif|gif|svg)$/i.test(url.pathname) || url.hostname.includes("unsplash") || url.hostname.includes("supabase.co");
const isStatic = (url) => url.pathname.startsWith("/_next/static/");
const bypass = (url) =>
  url.pathname.startsWith("/api/") ||
  url.pathname.startsWith("/auth/") ||
  url.pathname.startsWith("/book/success") ||
  url.pathname.includes("stripe");

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;
  const url = new URL(request.url);
  if (bypass(url)) return;

  // Navigations → network-first with offline fallback.
  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }
  // Images → stale-while-revalidate.
  if (isImage(url)) {
    event.respondWith(
      caches.open(IMAGES).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request).then((res) => { if (res.ok) cache.put(request, res.clone()); return res; }).catch(() => cached);
        return cached || network;
      }),
    );
    return;
  }
  // Static build assets → cache-first.
  if (isStatic(url)) {
    event.respondWith(caches.open(SHELL).then(async (cache) => (await cache.match(request)) || fetch(request).then((res) => { cache.put(request, res.clone()); return res; })));
  }
});

/* Web Push (PWA) — shows notifications delivered via the Push API. */
self.addEventListener("push", (event) => {
  if (!event.data) return;
  let payload = {};
  try { payload = event.data.json(); } catch { payload = { title: "iGlamHer", body: event.data.text() }; }
  event.waitUntil(
    self.registration.showNotification(payload.title || "iGlamHer", {
      body: payload.body || "",
      icon: "/brand/logo-word.png",
      badge: "/brand/logo-word.png",
      data: { url: payload.url || "/notifications" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  event.waitUntil(self.clients.openWindow(event.notification.data?.url || "/notifications"));
});
