import { siteConfig } from "@/config/site";

export default function sitemap() {
  const base = siteConfig.url;
  const pages = ["", "/faq", "/privacy", "/terms", "/contact", "/login", "/register"];
  return pages.map((p) => ({ url: `${base}${p}`, lastModified: new Date() }));
}
