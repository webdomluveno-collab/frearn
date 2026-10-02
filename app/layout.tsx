import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./fx/base.css";
import "./fx/product.css";
import "./fx/public.css";
import "./fx/art-direction.css";
import { baseMetadata } from "@/lib/seo";

const dmSans = localFont({
  src: "./fx/fonts/dm-sans-latin.woff2",
  weight: "100 1000",
  variable: "--font-dm-sans",
  display: "swap",
});

const barlow = localFont({
  src: "./fx/fonts/barlow-condensed-latin-700.woff2",
  weight: "700",
  variable: "--font-display",
  display: "swap",
});

export const metadata: Metadata = baseMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${dmSans.variable} ${barlow.variable}`}>
      <body>{children}</body>
    </html>
  );
}
