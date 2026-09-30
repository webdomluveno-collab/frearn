import { EarnProviderTabs } from "@/components/earn-provider-tabs";
import { DemoBrowser } from "@/components/demo-browser";
import { SectionHeading } from "@/components/fx/primitives";
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
      <SectionHeading
        eyebrow="FIND YOUR NEXT LITTLE WIN"
        title="A little time. Plenty of possibilities."
        description="Pick what fits your day. Know what’s involved before you start."
      />

      <EarnProviderTabs cpxLive={cpxLive} />

      {showDemo && <DemoBrowser />}
    </div>
  );
}
