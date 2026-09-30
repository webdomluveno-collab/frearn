import { bitlabsProvider } from "./bitlabs";
import { mockProvider } from "./mock";
import { isTimewallWallAvailable } from "./timewall/wall";
import type { OpportunityProvider, SurveyWallProvider } from "./types";

/** Registry — add future providers here without touching UI code. */
const providers: Record<string, OpportunityProvider> = {
  mock: mockProvider,
  bitlabs: bitlabsProvider,
};

export function getProvider(key: string): OpportunityProvider | undefined {
  return providers[key];
}

/** SurveyWall registry (CPX surveys; AdGem offers & games; more later). UI never hardcodes providers. */
const surveyWalls: Record<string, SurveyWallProvider> = {
  // NOTE: reads server env directly instead of importing ./cpx/server so this
  // module stays importable anywhere. In client bundles non-public env vars
  // compile to undefined, so this safely reports false there. The secret itself
  // is only ever touched inside ./cpx/server.ts (which has `import "server-only"`).
  cpx: {
    key: "cpx",
    label: "Surveys",
    isConfigured: () =>
      Boolean(process.env.CPX_APP_SECURE_HASH) && process.env.CPX_POSTBACK_ENABLED === "true",
  },
  // AdGem wall URL carries no secret, so there is nothing server-side to
  // configure; availability/emptiness is handled gracefully by the wall UI.
  adgem: {
    key: "adgem",
    label: "Offers & Games",
    isConfigured: () => true,
  },
  // TimeWall wall URL is server-side configuration without secrets (see
  // ./timewall/wall.ts). Reports false until the official Placement URL is
  // configured after approval — callers must hide the tab while unavailable.
  timewall: {
    key: "timewall",
    label: "TimeWall",
    isConfigured: () => isTimewallWallAvailable(),
  },
};

export function getSurveyWall(key: string): SurveyWallProvider | undefined {
  return surveyWalls[key];
}

/** Default server-side opportunity source (mock in dev/pre-launch, empty in prod). */
export async function listOpportunities(args: {
  country?: string;
  category?: "all" | import("@/types").OpportunityCategory;
}) {
  // Pre-launch: only demo data, clearly labeled by callers.
  return mockProvider.getOpportunities(args);
}
