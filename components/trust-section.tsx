import { ShieldCheck, Lock, EyeOff, Siren, ReceiptText } from "lucide-react";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const items = [
  { icon: ReceiptText, tint: "bg-indigo-500/10 text-indigo-600 dark:text-indigo-300", title: "Transparent rewards", body: "Time and reward shown before you start. Full transaction history.", span: true },
  { icon: Lock, tint: "bg-emerald-500/10 text-emerald-600 dark:text-emerald-300", title: "Secure accounts", body: "Email verification, secure sessions, and sensible defaults.", span: false },
  { icon: EyeOff, tint: "bg-violet-500/10 text-violet-600 dark:text-violet-300", title: "Privacy-first profiles", body: "Only the profile details needed for matching. Nothing excessive.", span: false },
  { icon: Siren, tint: "bg-amber-500/10 text-amber-600 dark:text-amber-300", title: "Fraud prevention", body: "Abuse, automation, and duplicate-account detection hooks built in.", span: false },
  { icon: ShieldCheck, tint: "bg-sky-500/10 text-sky-600 dark:text-sky-300", title: "Clear history", body: "Every earning, pending reward, and withdrawal is traceable.", span: false },
];

export function TrustSection() {
  return (
    <section className="border-t border-border/60 bg-muted/30">
      <div className="container py-20 md:py-28">
        <Reveal className="mx-auto max-w-2xl text-center">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Trust & safety</p>
          <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
            Built for <span className="text-gradient">trust</span>
          </h2>
          <p className="mt-3 text-muted-foreground">
            We don&apos;t claim certifications we don&apos;t have. Here is what we do commit to.
          </p>
        </Reveal>
        <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {items.map((item, i) => (
            <Reveal key={item.title} delay={(i % 4) * 90} className={cn(item.span && "sm:col-span-2 lg:col-span-2")}>
              <article className="card-lift h-full rounded-3xl border bg-card p-7 card-shadow">
                <span className={cn("inline-flex items-center justify-center rounded-2xl p-3", item.tint)} style={{ width: 48, height: 48 }}>
                  <item.icon size={22} aria-hidden />
                </span>
                <h3 className="font-display mt-5 text-lg font-bold">{item.title}</h3>
                <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{item.body}</p>
              </article>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}
