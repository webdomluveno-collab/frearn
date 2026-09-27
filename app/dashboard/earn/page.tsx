import { EarnProviderTabs } from "@/components/earn-provider-tabs";
import { DemoBrowser } from "@/components/demo-browser";
import { Badge } from "@/components/ui/badge";
import { getSurveyWall } from "@/lib/providers";
import { isMockAllowed } from "@/lib/providers/mock";

/**
 * Earn page. Surveys render through the authenticated CPX SurveyWall,
 * offers & games through the authenticated AdGem offerwall.
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

      <EarnProviderTabs cpxLive={cpxLive} />

      {showDemo && <DemoBrowser />}
    </div>
  );
}
