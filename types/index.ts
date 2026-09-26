/**
 * Core domain types. Monetary values are整数 cents (never floats).
 * DB uses NUMERIC/DECIMAL or BIGINT cents; TS uses integer cents.
 */

export type OpportunityCategory =
  | "surveys"
  | "offers"
  | "games"
  | "research"
  | "app-testing"
  | "microtasks";

export type OpportunityStatus = "active" | "paused" | "expired";

export interface Opportunity {
  id: string;
  /** Internal provider key (e.g. "mock", "bitlabs"). Never shown to users. */
  provider: string;
  providerOfferId: string;
  title: string;
  description: string;
  category: OpportunityCategory;
  /** ISO country code the opportunity targets, or "GLOBAL". */
  country: string;
  /** Integer USD cents the user earns. */
  rewardCents: number;
  /** Integer USD cents the publisher earns (for margin accounting). */
  publisherRevenueCents: number;
  estimatedMinutes: number;
  status: OpportunityStatus;
  /** Off-site URL — resolved server-side only at click time. */
  externalUrl: string;
  createdAt: string;
}

export type LedgerType =
  | "survey_reward"
  | "offer_reward"
  | "adjustment"
  | "withdrawal"
  | "reversal";

export type LedgerStatus = "pending" | "confirmed" | "reversed";

export interface LedgerTransaction {
  id: string;
  userId: string;
  type: LedgerType;
  status: LedgerStatus;
  /** Integer cents. Negative for withdrawals. */
  amountCents: number;
  description: string;
  idempotencyKey: string;
  createdAt: string;
}

export type WithdrawalStatus =
  | "requested"
  | "reviewing"
  | "approved"
  | "processing"
  | "paid"
  | "rejected";

export interface WithdrawalRequest {
  id: string;
  userId: string;
  amountCents: number;
  method: string;
  destination: string;
  status: WithdrawalStatus;
  createdAt: string;
}

export interface ProviderEvent {
  provider: string;
  externalEventId: string;
  userId: string;
  externalOfferId: string;
  eventType: string;
  publisherRevenueCents: number;
  userRewardCents: number;
  rawPayload: unknown;
  receivedAt: string;
  processedAt: string | null;
}

export interface FraudFlag {
  id: string;
  userId: string;
  reason: string;
  severity: "low" | "medium" | "high";
  createdAt: string;
}
