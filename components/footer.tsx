import Link from "next/link";
import { siteConfig } from "@/config/site";
import { buttonVariants } from "./ui/button";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Earn", href: "/#earn-types" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "Rewards", href: "/#rewards" },
      { label: "FAQ", href: "/faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/#top" },
      { label: "Contact", href: "/contact" },
      { label: "Sign in", href: "/login" },
      { label: "Get started", href: "/register" },
    ],
  },
  {
    title: "Legal",
    links: [
      { label: "Privacy", href: "/privacy" },
      { label: "Terms", href: "/terms" },
    ],
  },
];

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="border-t border-border/60 bg-muted/30">
      <div className="container grid gap-12 py-14 md:grid-cols-[1.3fr_2fr]">
        <div>
          <Logo />
          <p className="font-display mt-4 font-semibold">{siteConfig.tagline}</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
            Complete useful online tasks. Earn transparent rewards. Currently in early access —
            availability varies by country and profile.
          </p>
          <Link href="/register" className={cn(buttonVariants(), "mt-5")}>Get started</Link>
        </div>
        <div className="grid grid-cols-2 gap-8 sm:grid-cols-3">
          {columns.map((col) => (
            <nav key={col.title} aria-label={`Footer — ${col.title}`}>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-muted-foreground">{col.title}</p>
              <ul className="mt-4 space-y-2.5 text-[15px]">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="text-muted-foreground transition-colors hover:text-foreground">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
      </div>
      <div className="border-t border-border/60">
        <div className="container flex flex-col gap-2 py-5 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {year} {siteConfig.name}. All rights reserved.</p>
          <p>
            Contact:{" "}
            <a className="font-medium underline underline-offset-4 hover:text-foreground" href={`mailto:${siteConfig.supportEmail}`}>
              {siteConfig.supportEmail}
            </a>
          </p>
        </div>
      </div>
    </footer>
  );
}
