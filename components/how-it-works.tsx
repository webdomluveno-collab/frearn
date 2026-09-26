import { UserRoundPlus, ListChecks, Wallet } from "lucide-react";
import { Reveal } from "./reveal";

const steps = [
  {
    n: "01",
    icon: UserRoundPlus,
    gradient: "from-indigo-500 to-violet-500",
    title: "Create your profile",
    body: "Tell us a little about yourself so we can match you with relevant opportunities.",
  },
  {
    n: "02",
    icon: ListChecks,
    gradient: "from-violet-500 to-fuchsia-500",
    title: "Complete opportunities",
    body: "Choose surveys and tasks that fit your profile and schedule.",
  },
  {
    n: "03",
    icon: Wallet,
    gradient: "from-fuchsia-500 to-indigo-500",
    title: "Earn rewards",
    body: "Track your earnings and request a withdrawal when eligible.",
  },
];

export function HowItWorks() {
  return (
    <section id="how-it-works" className="container scroll-mt-24 py-20 md:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">How it works</p>
        <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Earning starts in <span className="text-gradient">three steps</span>
        </h2>
        <p className="mt-3 text-muted-foreground">A simple, transparent flow. No hidden steps.</p>
      </Reveal>
      <div className="relative mt-12 grid gap-5 md:grid-cols-3">
        <div aria-hidden className="absolute left-[16%] right-[16%] top-16 hidden border-t-2 border-dashed border-border md:block" />
        {steps.map((s, i) => (
          <Reveal key={s.n} delay={i * 120}>
            <article className="card-lift relative h-full rounded-3xl border bg-card p-7 card-shadow">
              <span aria-hidden className="font-display pointer-events-none absolute right-6 top-5 text-5xl font-extrabold text-muted/80 dark:text-muted/40">
                {s.n}
              </span>
              <span className={`inline-flex items-center justify-center rounded-2xl bg-gradient-to-br p-3.5 text-white shadow-lg ${s.gradient}`} style={{ width: 52, height: 52 }}>
                <s.icon size={24} aria-hidden />
              </span>
              <h3 className="font-display mt-5 text-lg font-bold">{s.title}</h3>
              <p className="mt-2 text-[15px] leading-relaxed text-muted-foreground">{s.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
