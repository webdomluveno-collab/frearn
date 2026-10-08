import { EarnProviderTabs } from "@/components/earn-provider-tabs";
import { DemoBrowser } from "@/components/demo-browser";
import { SectionHeading } from "@/components/fx/primitives";
import { getSurveyWall } from "@/lib/providers";
import { isMockAllowed } from "@/lib/providers/mock";

/**
 * Earn page. Surveys render through the authenticated CPX SurveyWall,
 * offers & games through the authenticated AdGem offerwall, and TimeWall
 * tasks through the authenticated TimeWall launcher (new-tab flow).
 * No fake production surveys: demo content appears in development only.
 */
export default function EarnPage() {
  const cpxLive = getSurveyWall("cpx")?.isConfigured() ?? false;
  const showDemo = isMockAllowed();

  return (
    <div className="earn-page space-y-8">
      <SectionHeading
        eyebrow="FIND YOUR NEXT LITTLE WIN"
        title="A little time. Plenty of possibilities."
        description="Pick what fits your day. Know what’s involved before you start."
      />

      <div className="earn-intro" aria-label="How earning works">
        <div><span>01</span><p>Find your fit.<small>Choose a survey, offer or task.</small></p></div>
        <div><span>02</span><p>Know the details.<small>Check rewards and requirements.</small></p></div>
        <div><span>03</span><p>Make it count.<small>Rewards wait for provider confirmation.</small></p></div>
      </div>
      <EarnProviderTabs cpxLive={cpxLive} />

      {showDemo && <DemoBrowser />}
    </div>
  );
}
