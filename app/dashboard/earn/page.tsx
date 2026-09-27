import Link from "next/link";
import { CpxSurveyWall } from "@/components/cpx-survey-wall";
import { DemoBrowser } from "@/components/demo-browser";
import { Badge } from "@/components/ui/badge";
import { getSurveyWall } from "@/lib/providers";
import { isMockAllowed } from "@/lib/providers/mock";

/**
 * Earn page. Surveys render through the authenticated CPX SurveyWall.
 * No fake production surveys: demo content appears in development only.
 */
export default function EarnPage() {
  const cpxLive = getSurveyWall("cpx")?.isConfigured() ?? false;
  const showDemo = isMockAllowed();

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight">Earn</h1>
        {cpxLive ? <Badge tone="success">Live surveys</Badge> : <Badge tone="info">Preparing surveys</Badge>}
      </div>

      <section aria-label="Surveys" className="space-y-4">
        <div>
          <h2 className="text-lg font-bold tracking-tight">Surveys</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Complete surveys matched to your profile and earn rewards.
          </p>
        </div>
        {cpxLive ? (
          <CpxSurveyWall />
        ) : (
          <div className="rounded-2xl border bg-card p-6 card-shadow">
            <p className="font-semibold">We&apos;re preparing surveys for your region.</p>
            <p className="mt-1 max-w-md text-sm text-muted-foreground">
              Availability varies by country and profile. Complete your{" "}
              <Link href="/dashboard/profile" className="underline">profile</Link> so we can match
              you with relevant opportunities as soon as they open.
            </p>
          </div>
        )}
      </section>

      {showDemo && <DemoBrowser />}
    </div>
  );
}
