import { Globe2, MapPinned, CreditCard, Handshake } from "lucide-react";
import { siteConfig } from "@/config/site";
import { Reveal } from "./reveal";

const pills = [
  { icon: MapPinned, label: "Region-gated rollout" },
  { icon: CreditCard, label: "Country-specific payout methods" },
  { icon: Handshake, label: "Local partners over time" },
];

export function GlobalSection() {
  return (
    <section className="container py-6 md:py-10">
      <Reveal>
        <div className="relative overflow-hidden rounded-[28px] border bg-gradient-to-br from-indigo-600 via-violet-600 to-fuchsia-600 p-8 text-white shadow-2xl shadow-indigo-600/25 sm:p-12">
          <div aria-hidden className="absolute inset-0">
            <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/15 blur-3xl" />
            <div className="absolute -bottom-24 -left-16 h-72 w-72 rounded-full bg-black/15 blur-3xl" />
            <Globe2 aria-hidden className="absolute -right-8 -bottom-10 h-64 w-64 text-white/10" strokeWidth={1} />
          </div>
          <div className="relative max-w-2xl">
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-100">Global by design</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight sm:text-4xl">
              Built for users around the world
            </h2>
            <p className="mt-3 leading-relaxed text-indigo-50/90">{siteConfig.availabilityNote}</p>
            <ul className="mt-6 flex flex-wrap gap-2.5">
              {pills.map((p) => (
                <li key={p.label} className="inline-flex items-center gap-1.5 rounded-full bg-white/12 px-4 py-2 text-sm font-medium backdrop-blur">
                  <p.icon size={15} aria-hidden /> {p.label}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </Reveal>
    </section>
  );
}
