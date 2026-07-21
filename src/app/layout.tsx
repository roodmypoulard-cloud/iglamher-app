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

export const metadata: Metadata = {
  title: "iGlamHer — Book Beauty. Anytime. Anywhere.",
  description:
    "Discover and book nearby hair, makeup, lash and styling professionals. Luxury beauty services that come to you, in Los Angeles.",
  applicationName: "iGlamHer",
  manifest: "/manifest.webmanifest",
  appleWebApp: { capable: true, title: "iGlamHer", statusBarStyle: "black-translucent" },
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
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
