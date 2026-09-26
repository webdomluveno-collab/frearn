"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { siteConfig } from "@/config/site";
import { buttonVariants } from "./ui/button";
import { ThemeToggle } from "./theme-toggle";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";

export function Navbar() {
  const [open, setOpen] = useState(false);
  return (
    <header className="fixed inset-x-0 top-0 z-40">
      <div className="glass border-b border-border/60">
        <nav aria-label="Primary" className="container flex h-[68px] items-center justify-between gap-4">
          <Logo />
          <div className="hidden items-center gap-1 rounded-full border border-border/70 bg-muted/50 p-1 text-sm font-medium text-muted-foreground md:flex">
            {siteConfig.nav.map((i) => (
              <Link key={i.label} href={i.href} className="rounded-full px-4 py-1.5 transition-colors hover:bg-background hover:text-foreground hover:shadow-sm">
                {i.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-1.5">
            <ThemeToggle />
            <Link href="/login" className="hidden px-3 text-sm font-semibold text-muted-foreground transition-colors hover:text-foreground sm:block">
              Sign in
            </Link>
            <Link href="/register" className={cn(buttonVariants(), "hidden sm:inline-flex")}>Get started</Link>
            <button
              className="inline-flex h-10 w-10 items-center justify-center rounded-full hover:bg-muted md:hidden"
              aria-expanded={open}
              aria-label={open ? "Close menu" : "Open menu"}
              onClick={() => setOpen((v) => !v)}
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </nav>
        {open && (
          <nav aria-label="Mobile" className="border-t border-border/60 px-5 pb-5 pt-2 md:hidden">
            <div className="grid gap-1">
              {siteConfig.nav.map((i) => (
                <Link key={i.label} href={i.href} onClick={() => setOpen(false)} className="rounded-xl px-3 py-2.5 text-[15px] font-medium hover:bg-muted">
                  {i.label}
                </Link>
              ))}
              <div className="mt-2 flex gap-2">
                <Link href="/login" onClick={() => setOpen(false)} className={cn(buttonVariants({ variant: "outline" }), "flex-1")}>Sign in</Link>
                <Link href="/register" onClick={() => setOpen(false)} className={cn(buttonVariants(), "flex-1")}>Get started</Link>
              </div>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
