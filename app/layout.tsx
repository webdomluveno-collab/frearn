import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import "./fx/base.css";
import "./fx/product.css";
import "./fx/public.css";
import { baseMetadata } from "@/lib/seo";

const dmSans = localFont({
  src: "./fx/fonts/dm-sans-latin.woff2",
  weight: "100 1000",
  variable: "--font-dm-sans",
  display: "swap",
});

export const metadata: Metadata = baseMetadata();

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={dmSans.variable}>
      <body>{children}</body>
    </html>
  );
}
