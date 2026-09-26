"use client";

import { useState } from "react";
import { Timer, Coins, Gauge, LayoutGrid } from "lucide-react";
import { Reveal } from "./reveal";

const points = [
  { icon: Timer, title: "Estimated time", body: "Know the commitment before you begin." },
  { icon: Coins, title: "Reward upfront", body: "The exact payout, visible on every card." },
  { icon: Gauge, title: "Reward per minute", body: "Compare opportunities at a glance." },
  { icon: LayoutGrid, title: "Clear categories", body: "Surveys, offers, games and more." },
];

function Calculator() {
  const [reward, setReward] = useState(1.2);
  const [minutes, setMinutes] = useState(8);
  const perMin = minutes > 0 ? reward / minutes : 0;

  return (
    <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur sm:p-8">
      <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Try it · demo</p>
      <h3 className="font-display mt-2 text-xl font-bold text-white">What&apos;s your time worth?</h3>
      <div className="mt-6 space-y-6">
        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="calc-reward" className="font-medium text-slate-300">Reward</label>
            <span className="font-display font-bold text-white">${reward.toFixed(2)}</span>
          </div>
          <input
            id="calc-reward" type="range" min={0.2} max={5} step={0.05} value={reward}
            onChange={(e) => setReward(Number(e.target.value))}
            className="mt-2 w-full accent-indigo-400" aria-valuetext={`$${reward.toFixed(2)}`}
          />
        </div>
        <div>
          <div className="flex items-center justify-between text-sm">
            <label htmlFor="calc-minutes" className="font-medium text-slate-300">Estimated time</label>
            <span className="font-display font-bold text-white">{minutes} min</span>
          </div>
          <input
            id="calc-minutes" type="range" min={2} max={30} step={1} value={minutes}
            onChange={(e) => setMinutes(Number(e.target.value))}
            className="mt-2 w-full accent-indigo-400" aria-valuetext={`${minutes} minutes`}
          />
        </div>
        <div className="flex items-end justify-between rounded-2xl bg-gradient-to-r from-indigo-500/25 to-fuchsia-500/20 p-5">
          <div>
            <p className="text-xs uppercase tracking-widest text-slate-400">Reward per minute</p>
            <p className="font-display text-4xl font-extrabold text-white" aria-live="polite">
              ${perMin.toFixed(2)}
            </p>
          </div>
          <p className="max-w-[150px] text-right text-xs leading-relaxed text-slate-400">
            Every opportunity shows this number before you start.
          </p>
        </div>
      </div>
    </div>
  );
}

export function Transparency() {
  return (
    <section className="relative overflow-hidden bg-slate-950 py-20 text-slate-200 md:py-28">
      <div aria-hidden className="absolute inset-0">
        <div className="bg-grid absolute inset-0 opacity-60 [background-image:linear-gradient(to_right,rgb(255_255_255/.05)_1px,transparent_1px),linear-gradient(to_bottom,rgb(255_255_255/.05)_1px,transparent_1px)]" />
        <div className="animate-orb absolute -top-24 left-1/4 h-80 w-80 rounded-full bg-indigo-600/25 blur-3xl" />
        <div className="absolute -bottom-32 right-1/5 h-80 w-80 rounded-full bg-fuchsia-600/20 blur-3xl" />
      </div>
      <div className="container relative grid items-center gap-12 lg:grid-cols-2">
        <div>
          <Reveal>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-300">Transparency first</p>
            <h2 className="font-display mt-3 text-3xl font-bold tracking-tight text-white sm:text-4xl">
              Know what your time is worth.
            </h2>
            <p className="mt-3 max-w-md leading-relaxed text-slate-400">
              See the estimated time and reward before starting an opportunity. No surprises after you finish.
            </p>
          </Reveal>
          <div className="mt-8 grid gap-4 sm:grid-cols-2">
            {points.map((p, i) => (
              <Reveal key={p.title} delay={i * 90}>
                <div className="h-full rounded-2xl border border-white/10 bg-white/[0.04] p-5 backdrop-blur transition-colors duration-300 hover:border-indigo-400/40">
                  <p.icon size={20} className="text-indigo-300" aria-hidden />
                  <p className="mt-3 font-semibold text-white">{p.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-slate-400">{p.body}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>
        <Reveal delay={150}>
          <Calculator />
        </Reveal>
      </div>
    </section>
  );
}
