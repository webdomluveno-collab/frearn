import { ClipboardList, BadgePercent, Gamepad2, FlaskConical, Smartphone, MousePointerClick } from "lucide-react";
import { Badge } from "./ui/badge";
import { Reveal } from "./reveal";
import { cn } from "@/lib/utils";

const types = [
  { icon: ClipboardList, title: "Surveys", body: "Share opinions matched to your profile.", live: true, gradient: "from-indigo-500 to-violet-500" },
  { icon: BadgePercent, title: "Offers", body: "Try partner products and services.", live: false, gradient: "from-slate-400 to-slate-500" },
  { icon: Gamepad2, title: "Games", body: "Play and give gameplay feedback.", live: false, gradient: "from-slate-400 to-slate-500" },
  { icon: FlaskConical, title: "Research", body: "Join longer academic and market studies.", live: false, gradient: "from-slate-400 to-slate-500" },
  { icon: Smartphone, title: "App testing", body: "Test beta apps and report issues.", live: false, gradient: "from-slate-400 to-slate-500" },
  { icon: MousePointerClick, title: "Microtasks", body: "Small tasks that fit short breaks.", live: false, gradient: "from-slate-400 to-slate-500" },
];

export function OpportunityTypes() {
  return (
    <section id="earn-types" className="container scroll-mt-24 py-20 md:py-28">
      <Reveal className="mx-auto max-w-2xl text-center">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-primary">Earning options</p>
        <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
          Six ways to earn, <span className="text-gradient">starting with surveys</span>
        </h2>
        <p className="mt-3 text-muted-foreground">
          Surveys are our initial pre-launch focus. Other categories unlock gradually.
        </p>
      </Reveal>
      <div className="mt-12 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {types.map((t, i) => (
          <Reveal key={t.title} delay={(i % 3) * 100}>
            <article className={cn("card-lift group h-full rounded-3xl border bg-card p-7 card-shadow", !t.live && "bg-muted/40")}>
              <div className="flex items-start justify-between">
                <span className={cn("inline-flex items-center justify-center rounded-2xl bg-gradient-to-br p-3 text-white shadow-lg transition-transform duration-300 group-hover:scale-110 group-hover:-rotate-6", t.gradient)} style={{ width: 48, height: 48 }}>
                  <t.icon size={22} aria-hidden />
                </span>
                {t.live ? <Badge tone="success">Initial focus</Badge> : <Badge>Coming later</Badge>}
              </div>
              <h3 className="font-display mt-5 text-lg font-bold">{t.title}</h3>
              <p className="mt-1.5 text-[15px] leading-relaxed text-muted-foreground">{t.body}</p>
            </article>
          </Reveal>
        ))}
      </div>
    </section>
  );
}
