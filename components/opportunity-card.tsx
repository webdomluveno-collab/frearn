import type { Opportunity } from "@/types";
import { centsToUsd, rewardPerMinute } from "@/lib/money";
import { Badge } from "./ui/badge";
import { Card, CardContent } from "./ui/card";
import { Clock } from "lucide-react";
import { cn } from "@/lib/utils";

/** Provider-neutral card. Never renders internal provider key. */
export function OpportunityCard({ opp, demo = false }: { opp: Opportunity; demo?: boolean }) {
  return (
    <Card className="card-lift overflow-hidden">
      <div aria-hidden className="h-1 bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 opacity-80" />
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-display font-bold leading-tight">{opp.title}</p>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{opp.description}</p>
          </div>
          {demo ? <Badge tone="info">Demo</Badge> : <Badge>{opp.category}</Badge>}
        </div>
        <dl className="grid grid-cols-3 gap-2 text-sm">
          <div className="rounded-2xl bg-muted/60 p-3">
            <dt className="flex items-center gap-1 text-xs text-muted-foreground"><Clock size={12} aria-hidden /> Time</dt>
            <dd className="font-display mt-0.5 font-bold">{opp.estimatedMinutes} min</dd>
          </div>
          <div className="rounded-2xl bg-muted/60 p-3">
            <dt className="text-xs text-muted-foreground">Reward</dt>
            <dd className="font-display mt-0.5 font-bold">{centsToUsd(opp.rewardCents)}</dd>
          </div>
          <div className={cn("rounded-2xl p-3", "bg-gradient-to-br from-indigo-500/12 to-fuchsia-500/12")}>
            <dt className="text-xs text-muted-foreground">Per min</dt>
            <dd className="font-display mt-0.5 font-bold text-primary">{rewardPerMinute(opp.rewardCents, opp.estimatedMinutes)}</dd>
          </div>
        </dl>
        <p className="text-xs capitalize text-muted-foreground">{opp.category} · {opp.country}</p>
      </CardContent>
    </Card>
  );
}
