import { bitlabsProvider } from "./bitlabs";
import { mockProvider } from "./mock";
import type { OpportunityProvider } from "./types";

/** Registry — add future providers here without touching UI code. */
const providers: Record<string, OpportunityProvider> = {
  mock: mockProvider,
  bitlabs: bitlabsProvider,
};

export function getProvider(key: string): OpportunityProvider | undefined {
  return providers[key];
}

/** Default server-side opportunity source (mock in dev/pre-launch, empty in prod). */
export async function listOpportunities(args: {
  country?: string;
  category?: "all" | import("@/types").OpportunityCategory;
}) {
  // Pre-launch: only demo data, clearly labeled by callers.
  return mockProvider.getOpportunities(args);
}
