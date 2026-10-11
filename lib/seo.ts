import type { Metadata } from "next";
import { siteConfig } from "@/config/site";

export function baseMetadata(overrides: Partial<Metadata> = {}): Metadata {
  const title = `${siteConfig.name} — ${siteConfig.tagline}`;
  return {
    metadataBase: new URL(siteConfig.url),
    title: { default: title, template: `%s · ${siteConfig.name}` },
    description: siteConfig.description,
    alternates: { canonical: "./" },
    openGraph: {
      type: "website",
      siteName: siteConfig.name,
      title,
      description: siteConfig.description,
    },
    twitter: {
      card: "summary",
      title,
      description: siteConfig.description,
    },
    ...overrides,
  };
}
