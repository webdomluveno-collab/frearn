import Link from "next/link";
import { siteConfig } from "@/config/site";
import { Brand } from "./fx/brand";

export function Footer() {
  const year = new Date().getFullYear();
  return (
    <footer className="public-footer">
      <Brand />
      <span>
        © {year} {siteConfig.name} · {siteConfig.tagline}
      </span>
      <div>
        <Link href="/login">Log in</Link>
        <Link href="/faq">FAQ</Link>
        <Link href="/contact">Contact</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </div>
    </footer>
  );
}
