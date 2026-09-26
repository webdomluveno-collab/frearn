"use client";

import { useState, type FormEvent } from "react";
import { Plus, Sparkles } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { siteConfig } from "@/config/site";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

export const FAQ_ITEMS = [
  {
    q: "What is Frearn?",
    a: "Frearn is an early-access rewards platform where users complete online surveys — and later other tasks — and track transparent rewards in one wallet.",
  },
  {
    q: "How do I earn rewards?",
    a: "Create a profile, choose opportunities matched to you, and complete them. Each opportunity shows estimated time and reward before you start.",
  },
  {
    q: "How much can I earn?",
    a: "It depends on your country, profile, and available opportunities. We show reward-per-minute so you can decide if an opportunity is worth your time. We don't promise fixed income.",
  },
  {
    q: "Are opportunities available in every country?",
    a: "No. Availability varies by country and profile. We're gradually expanding access around the world.",
  },
  {
    q: "Why might I not qualify for a survey?",
    a: "Surveys target specific demographics (e.g. age range, region, household). Starting a survey does not guarantee completion or reward — if you don't match the required profile, you may be screened out without payment.",
  },
  {
    q: "How do withdrawals work?",
    a: `Withdrawals are unavailable during early access. When enabled, you'll request a withdrawal above a minimum of $5.00. ${siteConfig.withdrawalNote}`,
  },
  {
    q: "What information do I need to provide?",
    a: "Email, password, country, and basic profile details used for matching (such as age range or employment status). We don't request unnecessary sensitive data.",
  },
  {
    q: "Can I create multiple accounts?",
    a: "No — one account per person. Duplicate accounts, automation, VPN-based location misrepresentation, and false profile information may lead to suspension and reversal of rewards.",
  },
];

export function FaqAccordion({ items = FAQ_ITEMS }: { items?: typeof FAQ_ITEMS }) {
  const [open, setOpen] = useState<number | null>(0);
  return (
    <div className="overflow-hidden rounded-3xl border bg-card card-shadow">
      {items.map((f, i) => {
        const isOpen = open === i;
        return (
          <div key={f.q} className={cn(i > 0 && "border-t border-border/70")}>
            <button
              className="flex w-full items-center justify-between gap-4 p-5 text-left font-semibold transition-colors hover:bg-muted/50 sm:px-6"
              aria-expanded={isOpen}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              {f.q}
              <span className={cn(
                "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-all duration-300",
                isOpen ? "btn-gradient rotate-45 text-white" : "bg-muted text-muted-foreground"
              )}>
                <Plus size={16} aria-hidden />
              </span>
            </button>
            <div className={cn("grid transition-all duration-300 ease-out", isOpen ? "[grid-template-rows:1fr] opacity-100" : "[grid-template-rows:0fr] opacity-0")}>
              <div className="overflow-hidden">
                <p className="px-5 pb-5 text-[15px] leading-relaxed text-muted-foreground sm:px-6">{f.a}</p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "done" | "error">("idle");

  // Static-hosting fallback: no /api route exists in the exported HTML version,
  // so offer a one-click email instead of a failing fetch.
  if (process.env.NEXT_PUBLIC_STATIC_EXPORT === "true") {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-sm leading-relaxed text-muted-foreground">
          Join the list by sending us a short email — we&apos;ll notify you when your region opens.
        </p>
        <a
          href={`mailto:${siteConfig.supportEmail}?subject=${encodeURIComponent("Early access request")}&body=${encodeURIComponent("Hi, please notify me when Frearn launches in my region.")}`}
          className="btn-gradient inline-flex h-12 items-center justify-center gap-2 whitespace-nowrap rounded-full px-7 text-sm font-semibold text-white transition-all duration-300 hover:-translate-y-px"
        >
          Request early access
        </a>
      </div>
    );
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    setState("loading");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      setState(res.ok ? "done" : "error");
    } catch {
      setState("error");
    }
  }

  if (state === "done")
    return (
      <p role="status" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-medium text-emerald-700 dark:text-emerald-300">
        You&apos;re on the early-access list. We&apos;ll be in touch.
      </p>
    );

  return (
    <form onSubmit={submit} className="flex flex-col gap-3 sm:flex-row">
      <label htmlFor="waitlist-email" className="sr-only">Email address</label>
      <Input
        id="waitlist-email"
        type="email"
        required
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        className="h-12 rounded-full bg-background px-5"
      />
      <Button type="submit" disabled={state === "loading"} className="h-12 shrink-0 px-7">
        {state === "loading" ? "Joining…" : "Join early access"}
      </Button>
      {state === "error" && <p role="alert" className="text-sm text-red-600">Something went wrong. Try again.</p>}
    </form>
  );
}

export function FaqWaitlistSection() {
  return (
    <section className="container grid gap-10 py-20 md:py-28 lg:grid-cols-[1.1fr_.9fr]">
      <div>
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">FAQ</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Honest answers, <span className="text-gradient">no hype</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            Including why survey qualification isn&apos;t guaranteed.{" "}
            <a href="/faq" className="font-medium text-primary underline-offset-4 hover:underline">Read all FAQs</a>
          </p>
        </Reveal>
        <Reveal delay={120} className="mt-8">
          <FaqAccordion />
        </Reveal>
      </div>
      <Reveal delay={180}>
        <div id="early-access" className="relative scroll-mt-28 overflow-hidden rounded-[28px] border bg-card p-8 card-shadow sm:p-10 lg:sticky lg:top-24">
          <div aria-hidden className="absolute inset-x-0 top-0 h-1.5 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500" />
          <div aria-hidden className="absolute -right-20 -top-20 h-48 w-48 rounded-full bg-violet-500/15 blur-3xl" />
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">
            <Sparkles size={13} aria-hidden /> Early access
          </span>
          <h3 className="font-display mt-4 text-2xl font-bold tracking-tight">Be first in line when your region opens</h3>
          <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">
            Live paid opportunities aren&apos;t available yet. Leave your email and we&apos;ll
            notify you when your region opens.
          </p>
          <div className="mt-6">
            <WaitlistForm />
          </div>
          <p className="mt-4 text-xs text-muted-foreground">One email when we launch. No spam, unsubscribe anytime.</p>
        </div>
      </Reveal>
    </section>
  );
}
