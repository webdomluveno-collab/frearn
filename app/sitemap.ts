import { siteConfig } from "@/config/site";

export default function sitemap() {
  const base = siteConfig.url;
  // Public, indexable pages only. Authenticated app screens, auth forms,
  // admin, and API routes are intentionally excluded (with noindex metadata).
  const pages = ["", "/faq", "/privacy", "/terms", "/contact", "/earn-money-online-india"];
  return pages.map((p) => ({ url: `${base}${p}`, lastModified: new Date() }));
}
