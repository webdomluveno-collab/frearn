import { ArrowUpRight, Nfc } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Badge } from "./ui/badge";
import { Button } from "./ui/button";
import { Reveal } from "./reveal";

export function WalletPreview() {
  return (
    <section id="rewards" className="relative scroll-mt-24 overflow-hidden py-20 md:py-28">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute left-1/2 top-0 h-72 w-[720px] -translate-x-1/2 rounded-full bg-violet-500/10 blur-3xl" />
      </div>
      <div className="container grid items-center gap-12 lg:grid-cols-2">
        <Reveal>
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Wallet</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            One wallet for <span className="text-gradient">everything you earn</span>
          </h2>
          <p className="mt-3 max-w-md leading-relaxed text-muted-foreground">
            Track balances, pending rewards, and lifetime earnings in one place.{" "}
            {siteConfig.withdrawalNote}
          </p>
          <div className="mt-6 flex flex-wrap gap-2">
            {siteConfig.futureWithdrawalMethods.map((m) => (
              <Badge key={m} tone="neutral">{m} · planned</Badge>
            ))}
          </div>
          <p className="mt-4 max-w-md text-xs leading-relaxed text-muted-foreground">
            Future withdrawal options are under evaluation. Nothing listed here is currently available.
          </p>
        </Reveal>

        <Reveal delay={150} className="relative">
          <div aria-hidden className="ring-conic absolute -inset-3 rounded-[28px] opacity-25 blur-2xl" />
          <div className="relative space-y-4">
            {/* Bank-card style demo card */}
            <div aria-label="Wallet preview with demo figures" className="relative overflow-hidden rounded-3xl bg-slate-950 p-7 text-white shadow-2xl shadow-indigo-950/30 sm:p-8">
              <div aria-hidden className="absolute inset-0">
                <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-indigo-500/40 blur-3xl" />
                <div className="absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-fuchsia-500/30 blur-3xl" />
              </div>
              <div className="relative flex items-start justify-between">
                <div>
                  <p className="text-xs uppercase tracking-[0.18em] text-slate-400">Available balance · demo</p>
                  <p className="font-display mt-1 text-5xl font-extrabold tracking-tight">$8.42</p>
                </div>
                <Nfc size={28} className="text-slate-500" aria-hidden />
              </div>
              <div className="relative mt-7 grid grid-cols-2 gap-3">
                <div className="rounded-2xl bg-white/[0.07] p-4 backdrop-blur">
                  <p className="text-xs text-slate-400">Pending</p>
                  <p className="font-display mt-0.5 text-xl font-bold">$1.20</p>
                </div>
                <div className="rounded-2xl bg-white/[0.07] p-4 backdrop-blur">
                  <p className="text-xs text-slate-400">Lifetime earnings</p>
                  <p className="font-display mt-0.5 text-xl font-bold">$26.85</p>
                </div>
              </div>
              <div className="relative mt-6 flex items-center gap-3">
                <Button disabled className="flex-1 opacity-70" title="Withdrawals are unavailable in pre-launch">
                  Withdraw <ArrowUpRight />
                </Button>
              </div>
              <p className="relative mt-3 text-center text-xs text-slate-500">Withdrawals are unavailable during early access.</p>
            </div>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
