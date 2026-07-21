import type { NextConfig } from "next";

// HTTPS-only hardening (HSTS + auto-upgrade) is applied only when the app is
// actually served over HTTPS. On http://localhost these break the OAuth return
// (the browser would upgrade http→https and fail), so they're omitted for dev.
const isHttps = (process.env.NEXT_PUBLIC_APP_URL ?? "").startsWith("https://");

// Content Security Policy. Self-hosted fonts (next/font) + inline styles (Tailwind)
// need 'unsafe-inline' for styles; scripts are self + Stripe.js only. Supabase
// REST + Realtime (wss) and Stripe API are the only external connect targets.
const csp = [
  "default-src 'self'",
  "script-src 'self' 'unsafe-inline' https://js.stripe.com",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob: https://images.unsplash.com https://*.supabase.co",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co https://api.stripe.com",
  "frame-src https://js.stripe.com https://hooks.stripe.com",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  ...(isHttps ? ["upgrade-insecure-requests"] : []),
].join("; ");

const securityHeaders = [
  { key: "Content-Security-Policy", value: csp },
  ...(isHttps
    ? [{ key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains; preload" }]
    : []),
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=(self), payment=(self)" },
  { key: "X-DNS-Prefetch-Control", value: "on" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "*.supabase.co" },
    ],
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
  // Deep-linking association files at their required well-known paths.
  async rewrites() {
    return [
      { source: "/.well-known/apple-app-site-association", destination: "/api/wellknown/aasa" },
      { source: "/.well-known/assetlinks.json", destination: "/api/wellknown/assetlinks" },
    ];
  },
};

export default nextConfig;
