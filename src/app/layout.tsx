import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Inter } from "next/font/google";
import "./globals.css";
import { AppProviders } from "@/components/AppProviders";

const cormorant = Cormorant_Garamond({
  variable: "--font-cormorant",
  weight: ["400", "500", "600", "700"],
  style: ["normal", "italic"],
  subsets: ["latin"],
  display: "swap",
});

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const siteTitle = "iGlamHer — Book Beauty. Anytime. Anywhere.";
const siteDescription =
  "Discover and book nearby hair, makeup, lash and styling professionals. Luxury beauty services that come to you, in Los Angeles.";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_APP_URL || "https://iglamher-app.vercel.app"),
  title: siteTitle,
  description: siteDescription,
  applicationName: "iGlamHer",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "iGlamHer", statusBarStyle: "black-translucent" },
  openGraph: {
    title: siteTitle,
    description: siteDescription,
    url: "/",
    siteName: "iGlamHer",
    type: "website",
    locale: "en_US",
    images: [
      {
        url: "/brand/hero.jpg",
        width: 1200,
        height: 630,
        alt: "iGlamHer — Book Beauty. Anytime. Anywhere.",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: siteTitle,
    description: siteDescription,
    images: ["/brand/hero.jpg"],
  },
};

export const viewport: Viewport = {
  themeColor: "#0B0909",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html
      lang="en"
      className={`${cormorant.variable} ${inter.variable} h-full antialiased`}
    >
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('iglamher-theme')||'system';var d=t==='dark'||(t==='system'&&window.matchMedia('(prefers-color-scheme: dark)').matches);document.documentElement.setAttribute('data-theme',d?'dark':'light');}catch(e){}})();`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col bg-bg text-ink">
        {/* Keyboard users jump straight past the nav; visible only on focus. */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-ink focus:px-5 focus:py-3 focus:text-sm focus:font-semibold focus:text-bg"
        >
          Skip to main content
        </a>
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
