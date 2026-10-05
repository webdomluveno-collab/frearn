import { EarnProviderTabs } from "@/components/earn-provider-tabs";
import { DemoBrowser } from "@/components/demo-browser";
import { SectionHeading } from "@/components/fx/primitives";
import { getSessionUser } from "@/lib/auth/server";
import { getSurveyWall } from "@/lib/providers";
import { isTimewallTestUser } from "@/lib/providers/timewall/wall";
import { isMockAllowed } from "@/lib/providers/mock";

/**
 * Earn page. Surveys render through the authenticated CPX SurveyWall,
 * offers & games through the authenticated AdGem offerwall.
 * TimeWall is visible ONLY to the controlled live-test account (server-side
 * session UUID match) — every other user sees the unavailable state.
 * No fake production surveys: demo content appears in development only.
 */
export default async function EarnPage() {
  const cpxLive = getSurveyWall("cpx")?.isConfigured() ?? false;
  const user = await getSessionUser();
  const timewallTestAccess = isTimewallTestUser(user?.id);
  const showDemo = isMockAllowed();

  return (
    <div className="space-y-8">
      <SectionHeading
        eyebrow="FIND YOUR NEXT LITTLE WIN"
        title="A little time. Plenty of possibilities."
        description="Pick what fits your day. Know what’s involved before you start."
      />

      <EarnProviderTabs cpxLive={cpxLive} timewallTestAccess={timewallTestAccess} />

      {showDemo && <DemoBrowser />}
    </div>
  );
}
