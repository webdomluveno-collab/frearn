import Link from "next/link";
import { useId } from "react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

/**
 * Frearn logo mark — a minimal reward coin/token in the brand gradient.
 * Geometric and calm (no "get rich quick" clichés): circle + inner ring + F.
 */
export function LogoMark({ size = 36, className }: { size?: number; className?: string }) {
  const id = useId();
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      role="img"
      aria-label={`${siteConfig.name} logo`}
      className={cn("shrink-0 transition-transform duration-300 group-hover:rotate-6 group-hover:scale-105", className)}
    >
      <defs>
        <linearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="hsl(var(--brand))" />
          <stop offset="1" stopColor="hsl(var(--brand-2))" />
        </linearGradient>
      </defs>
      <circle cx="24" cy="24" r="22" fill={`url(#${id})`} />
      <circle cx="24" cy="24" r="17.5" fill="none" stroke="#fff" strokeOpacity="0.45" strokeWidth="2" />
      <ellipse cx="17.5" cy="12.5" rx="7" ry="3.5" fill="#fff" opacity="0.25" transform="rotate(-24 17.5 12.5)" />
      <path d="M18.5 33V15h12.5v3.6h-8.5v3.9H29v3.6h-6.5V33h-4z" fill="#fff" />
    </svg>
  );
}

export function Logo() {
  return (
    <Link href="/" className="group flex items-center gap-2.5" aria-label={`${siteConfig.name} home`}>
      <LogoMark size={36} />
      <span className="font-display text-[17px] font-bold tracking-tight">{siteConfig.logoText}</span>
    </Link>
  );
}
