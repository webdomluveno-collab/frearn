import type { Opportunity } from "@/types";
import type { OpportunityProvider } from "./types";

/**
 * Safe mock provider for local development only.
 * - Clearly-labeled DEMO data.
 * - Disabled automatically in production unless MOCK_PROVIDER_ENABLED=true (server-side).
 */
export const DEMO_OPPORTUNITIES: Opportunity[] = [
  {
    id: "demo-consumer-preferences",
    provider: "mock",
    providerOfferId: "mock-001",
    title: "Consumer Preferences",
    description: "Share opinions on everyday products and shopping habits.",
    category: "surveys",
    country: "GLOBAL",
    rewardCents: 120,
    publisherRevenueCents: 200,
    estimatedMinutes: 8,
    status: "active",
    externalUrl: "#",
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-mobile-gaming",
    provider: "mock",
    providerOfferId: "mock-002",
    title: "Mobile Gaming Study",
    description: "Tell us how you discover and play mobile games.",
    category: "surveys",
    country: "GLOBAL",
    rewardCents: 240,
    publisherRevenueCents: 400,
    estimatedMinutes: 12,
    status: "active",
    externalUrl: "#",
    createdAt: new Date().toISOString(),
  },
  {
    id: "demo-shopping-poll",
    provider: "mock",
    providerOfferId: "mock-003",
    title: "Quick Shopping Poll",
    description: "A short poll about recent online purchases.",
    category: "surveys",
    country: "GLOBAL",
    rewardCents: 65,
    publisherRevenueCents: 110,
    estimatedMinutes: 4,
    status: "active",
    externalUrl: "#",
    createdAt: new Date().toISOString(),
  },
];

export function isMockAllowed(): boolean {
  if (process.env.MOCK_PROVIDER_ENABLED === "true") return true;
  if (process.env.MOCK_PROVIDER_ENABLED === "false") return false;
  // Default: allow in development, deny in production.
  return process.env.NODE_ENV !== "production";
}

export const mockProvider: OpportunityProvider = {
  key: "mock",
  async getOpportunities({ category }) {
    if (!isMockAllowed()) return [];
    if (!category || category === "all") return DEMO_OPPORTUNITIES;
    return DEMO_OPPORTUNITIES.filter((o) => o.category === category);
  },
  async getOpportunity(id) {
    if (!isMockAllowed()) return null;
    return DEMO_OPPORTUNITIES.find((o) => o.id === id) ?? null;
  },
  async validateCallback() {
    // Mock never validates real callbacks.
    return null;
  },
  normalizeCallback() {
    return null;
  },
};
