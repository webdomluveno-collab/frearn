import type {
  LedgerTransaction,
  Opportunity,
  OpportunityCategory,
  WithdrawalRequest,
} from "@/types";

/**
 * Provider abstraction — no provider is hardcoded in UI code.
 * UI calls getOpportunities() via lib/providers/index.ts.
 */
export interface NormalizedCallback {
  externalEventId: string;
  userId: string;
  externalOfferId: string;
  eventType: string;
  publisherRevenueCents: number;
  userRewardCents: number;
  rawPayload: unknown;
}

export interface OpportunityProvider {
  readonly key: string;
  getOpportunities(args: {
    userId?: string;
    country?: string;
    category?: OpportunityCategory | "all";
  }): Promise<Opportunity[]>;
  getOpportunity(id: string): Promise<Opportunity | null>;
  /** Validate an inbound callback signature. Return null when not configured. */
  validateCallback(req: Request): Promise<NormalizedCallback | null>;
  normalizeCallback(payload: unknown): NormalizedCallback | null;
}

/**
 * SurveyWall provider (e.g. CPX): users complete surveys inside a
 * server-generated, per-user wall URL rather than picking listed offers.
 * Kept separate so listing-based providers stay decoupled.
 */
export interface SurveyWallProvider {
  readonly key: string;
  readonly label: string;
  isConfigured(): boolean;
}

export type { LedgerTransaction, WithdrawalRequest };
