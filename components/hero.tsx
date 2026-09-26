import Link from "next/link";
import { ArrowRight, PlayCircle, BadgeCheck, Lock, Wallet, TrendingUp } from "lucide-react";
import { siteConfig } from "@/config/site";
import { buttonVariants } from "./ui/button";
import { Badge } from "./ui/badge";
import { DEMO_OPPORTUNITIES } from "@/lib/providers/mock";
import { centsToUsd, rewardPerMinute } from "@/lib/money";
import { Reveal } from "./reveal";

const trustPoints = [
  { icon: BadgeCheck, label: "Reward shown upfront" },
  { icon: Lock, label: "Privacy-first profiles" },
  { icon: Wallet, label: "One wallet for everything" },
];

export function Hero() {
  return (
    <section className="relative overflow-hidden" id="top">
      {/* Backdrop */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="bg-grid mask-fade-y absolute inset-0" />
        <div className="animate-orb absolute -top-32 left-1/2 h-[420px] w-[680px] -translate-x-1/2 rounded-full bg-gradient-to-r from-indigo-500/25 via-violet-500/20 to-fuchsia-500/15 blur-3xl dark:from-indigo-500/20 dark:via-violet-500/15 dark:to-fuchsia-500/10" />
        <div className="absolute -left-40 top-40 h-72 w-72 rounded-full bg-violet-400/15 blur-3xl" />
        <div className="absolute -right-40 top-64 h-72 w-72 rounded-full bg-indigo-400/15 blur-3xl" />
      </div>

      <div className="container grid items-center gap-14 pb-20 pt-14 md:pt-20 lg:grid-cols-[1.05fr_.95fr] lg:pb-28">
        <div>
          <Reveal>
            <span className="inline-flex items-center gap-2 rounded-full border border-border bg-card/80 py-1.5 pl-2.5 pr-4 text-xs font-semibold shadow-sm backdrop-blur">
              <span className="relative flex h-2 w-2">
                <span className="animate-pulse-dot absolute h-full w-full rounded-full bg-emerald-500" />
              </span>
              Early access · Pre-launch
              <span className="text-muted-foreground">— live earning isn&apos;t on yet</span>
            </span>
          </Reveal>
          <Reveal delay={90}>
            <h1 className="font-display mt-6 text-[42px] font-extrabold leading-[1.04] tracking-tight sm:text-6xl lg:text-[68px]">
              Turn your spare time into <span className="text-gradient">rewards.</span>
            </h1>
          </Reveal>
          <Reveal delay={170}>
            <p className="mt-5 max-w-lg text-lg leading-relaxed text-muted-foreground">
              {siteConfig.description}
            </p>
          </Reveal>
          <Reveal delay={240}>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link href="/register" className={buttonVariants({ size: "lg" })}>
                Get started <ArrowRight />
              </Link>
              <Link href="#how-it-works" className={buttonVariants({ size: "lg", variant: "outline" })}>
                <PlayCircle /> How it works
              </Link>
            </div>
          </Reveal>
          <Reveal delay={310}>
            <ul className="mt-8 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium text-muted-foreground">
              {trustPoints.map((t) => (
                <li key={t.label} className="flex items-center gap-1.5">
                  <t.icon size={16} className="text-emerald-600 dark:text-emerald-400" aria-hidden /> {t.label}
                </li>
              ))}
            </ul>
            <p className="mt-3 max-w-md text-xs leading-relaxed text-muted-foreground">
              {siteConfig.availabilityNote}
            </p>
          </Reveal>
        </div>

        {/* Product preview */}
        <Reveal delay={200} className="relative">
          <div aria-hidden className="ring-conic absolute -inset-3 rounded-[28px] opacity-25 blur-2xl" />
          <div aria-label="Product preview with demo data" className="glass relative rounded-3xl border p-5 shadow-2xl shadow-indigo-950/10 sm:p-6">
            {/* Browser chrome */}
            <div className="flex items-center gap-2 border-b border-border/70 pb-4">
              <span className="h-2.5 w-2.5 rounded-full bg-rose-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="ml-3 hidden flex-1 truncate rounded-full bg-muted/70 px-4 py-1 text-xs text-muted-foreground sm:block">
                {new URL(siteConfig.url).hostname}/earn
              </span>
              <Badge tone="info">Demo preview</Badge>
            </div>
            <div className="flex items-center justify-between pt-4">
              <p className="font-display text-[15px] font-bold">Matched for you</p>
              <p className="text-xs text-muted-foreground">Sample layout — availability varies</p>
            </div>
            <div className="mt-3 space-y-3">
              {DEMO_OPPORTUNITIES.map((o, i) => (
                <div
                  key={o.id}
                  className="group flex items-center gap-4 rounded-2xl border border-border/70 bg-background/80 p-3.5 transition-all duration-300 hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-indigo-500/10"
                >
                  <span aria-hidden className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl font-display text-sm font-bold text-white ${i === 0 ? "bg-gradient-to-br from-indigo-500 to-violet-500" : i === 1 ? "bg-gradient-to-br from-violet-500 to-fuchsia-500" : "bg-gradient-to-br from-sky-500 to-indigo-500"}`}>
                    {o.title.charAt(0)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{o.title}</span>
                    <span className="mt-0.5 block text-xs text-muted-foreground">
                      {o.estimatedMinutes} min · {rewardPerMinute(o.rewardCents, o.estimatedMinutes)}
                    </span>
                  </span>
                  <span className="shrink-0 rounded-full bg-emerald-500/10 px-3 py-1 text-sm font-bold text-emerald-700 dark:text-emerald-300">
                    {centsToUsd(o.rewardCents)}
                  </span>
                </div>
              ))}
            </div>

            {/* Floating cards */}
            <div aria-hidden className="animate-floaty absolute -left-4 top-24 hidden items-center gap-2.5 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl shadow-indigo-950/10 backdrop-blur lg:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 text-white">
                <Wallet size={17} />
              </span>
              <span>
                <span className="block text-[11px] text-muted-foreground">Available balance</span>
                <span className="font-display block text-sm font-bold">$8.42</span>
              </span>
            </div>
            <div aria-hidden className="animate-floaty-slow absolute -right-3 bottom-16 hidden items-center gap-2.5 rounded-2xl border bg-card/95 px-4 py-3 shadow-xl shadow-indigo-950/10 backdrop-blur lg:flex">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                <TrendingUp size={17} />
              </span>
              <span>
                <span className="block text-[11px] text-muted-foreground">Reward confirmed</span>
                <span className="font-display block text-sm font-bold">+$2.40</span>
              </span>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
