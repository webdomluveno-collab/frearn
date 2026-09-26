import type { OpportunityProvider } from "./types";

/**
 * BitLabs adapter — DOCUMENTED PLACEHOLDER.
 *
 * Integration is NOT active. Do not claim partnership.
 * When approved by the provider:
 *  1. Set BITLABS_APP_TOKEN + BITLABS_SECRET (server-only env).
 *  2. Set BITLABS_CALLBACK_ENABLED=true.
 *  3. Implement signature verification per BitLabs docs + wire
 *     /api/providers/bitlabs/callback to validateCallback().
 *
 * Secrets must never be exposed to the browser.
 */
export const bitlabsProvider: OpportunityProvider = {
  key: "bitlabs",
  async getOpportunities() {
    // TODO(provider): implement offerwall fetch after approval.
    return [];
  },
  async getOpportunity() {
    return null;
  },
  async validateCallback() {
    // Fail closed: without credentials/spec we must NOT verify anything.
    if (
      !process.env.BITLABS_APP_TOKEN ||
      !process.env.BITLABS_SECRET ||
      process.env.BITLABS_CALLBACK_ENABLED !== "true"
    ) {
      return null;
    }
    // TODO(provider): verify HMAC/signature per provider spec, then normalize.
    return null;
  },
  normalizeCallback() {
    return null;
  },
};
