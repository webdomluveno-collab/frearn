import { describe, expect, it } from "vitest";
import {
  callbackEntryTransactionId,
  callbackRewardTxId,
  intendedPublisherCents,
  intendedRewardCents,
  intendedUserCents,
  isDebugTrue,
  isEventId,
  isReasonableId,
  isReversalTrue,
  isUuid,
  readCallbackFields,
  THEOREMREACH_MAX_PUBLISHER_CENTS,
  THEOREMREACH_MAX_REWARD_CENTS,
} from "../shared";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

describe("TheoremReach callback field parsing (Phase 1)", () => {
  it("detects debug=true exactly (only the documented literal ignores)", () => {
    expect(isDebugTrue("true")).toBe(true);
    expect(isDebugTrue("True")).toBe(false);
    expect(isDebugTrue("1")).toBe(false);
    expect(isDebugTrue("")).toBe(false);
    expect(isDebugTrue(null)).toBe(false);
    expect(isDebugTrue(undefined)).toBe(false);
  });

  it("detects reversal=true exactly", () => {
    expect(isReversalTrue("true")).toBe(true);
    expect(isReversalTrue("false")).toBe(false);
    expect(isReversalTrue(null)).toBe(false);
  });

  it("requires a Supabase UUID for user_id", () => {
    expect(isUuid(UID)).toBe(true);
    expect(isUuid("user@example.com")).toBe(false);
    expect(isUuid("123")).toBe(false);
    expect(isUuid("")).toBe(false);
    expect(isUuid(null)).toBe(false);
  });

  it("rejects hostile identifier shapes", () => {
    expect(isReasonableId("abc-123_X.y:z")).toBe(true);
    expect(isReasonableId("a b")).toBe(false);
    expect(isReasonableId("")).toBe(false);
    expect(isReasonableId("x".repeat(129))).toBe(false);
    expect(isReasonableId("<script>")).toBe(false);
  });

  it("accepts opaque provider event ids but rejects whitespace/control", () => {
    expect(isEventId("abc+DEF/123==")).toBe(true);
    expect(isEventId("a b")).toBe(false);
    expect(isEventId("a\nb")).toBe(false);
    expect(isEventId("")).toBe(false);
    expect(isEventId("x".repeat(129))).toBe(false);
    expect(isEventId(null)).toBe(false);
  });

  it("uses provider tx_id as the reward identity, never entry transaction_id", () => {
    expect(callbackRewardTxId({ txId: "provider-reward-1" })).toBe("provider-reward-1");
    expect(callbackRewardTxId({ txId: "" })).toBe(null);
    expect(callbackRewardTxId({ txId: null })).toBe(null);
    expect(callbackRewardTxId({ txId: "<bad>" })).toBe(null);
  });

  it("parses the optional entry transaction_id separately and accepts different values", () => {
    expect(callbackEntryTransactionId({ transactionId: "entry-session-1" })).toBe("entry-session-1");
    expect(callbackEntryTransactionId({ transactionId: null })).toBe(null);
    expect(callbackEntryTransactionId({ transactionId: "" })).toBe(null);
    expect(callbackEntryTransactionId({ transactionId: "bad id" })).toBe(null);
    expect(callbackRewardTxId({ txId: "provider-reward-1" })).toBe("provider-reward-1");
    expect(callbackEntryTransactionId({ transactionId: "entry-session-1" })).toBe("entry-session-1");
  });

  it("reads all callback fields including deprecated status (never trusted)", () => {
    const params = new URLSearchParams({
      reward: "70",
      currency: "1.00",
      user_id: UID,
      transaction_id: "transaction-9",
      tx_id: "tx-9",
      hash: "abc",
      reversal: "true",
      debug: "true",
      status: "complete",
    });
    const f = readCallbackFields((n) => params.get(n));
    expect(f.rewardRaw).toBe("70");
    expect(isDebugTrue(f.debugRaw)).toBe(true);
    expect(isReversalTrue(f.reversalRaw)).toBe(true);
    expect(callbackRewardTxId(f)).toBe("tx-9");
    expect(callbackEntryTransactionId(f)).toBe("transaction-9");
  });
});

describe("TheoremReach money parsing", () => {
  it("reward=70 maps verbatim to 70 user cents with NO second multiplier", () => {
    expect(intendedUserCents(70)).toBe(70);
    expect(intendedUserCents("70")).toBe(70);
    // NOT 49: no 70% reapplication, ever.
    expect(intendedUserCents(70)).not.toBe(49);
  });

  it("rejects non-creditable reward shapes", () => {
    expect(intendedUserCents(70.5)).toBe(null);
    expect(intendedUserCents(0)).toBe(null);
    expect(intendedUserCents(-10)).toBe(null);
    expect(intendedUserCents(NaN)).toBe(null);
    expect(intendedUserCents("70.0")).toBe(null);
    expect(intendedUserCents("1e3")).toBe(null);
    expect(intendedUserCents(THEOREMREACH_MAX_REWARD_CENTS + 1)).toBe(null);
  });

  it("parses reward as integer cents string", () => {
    expect(intendedRewardCents("70")).toBe(70);
    expect(intendedRewardCents(70)).toBe(70);
    expect(intendedRewardCents("1000000")).toBe(1000000);
    expect(intendedRewardCents("70.5")).toBe(null);
  });

  it("parses publisher USD strings with exact half-up cents rounding", () => {
    expect(intendedPublisherCents(1.0)).toBe(100);
    expect(intendedPublisherCents(3.31)).toBe(331);
    expect(intendedPublisherCents("1.005")).toBe(101);
    expect(intendedPublisherCents("1.004")).toBe(100);
    expect(intendedPublisherCents("0.00")).toBe(0);
    expect(intendedPublisherCents(-1)).toBe(null);
    expect(intendedPublisherCents("-1.00")).toBe(null);
    expect(intendedPublisherCents(NaN)).toBe(null);
    expect(intendedPublisherCents("1e2")).toBe(null);
    expect(intendedPublisherCents("1.0000001")).toBe(null);
    expect(intendedPublisherCents("21474836.48")).toBe(null);
    expect(intendedPublisherCents("21474836.47")).toBe(THEOREMREACH_MAX_PUBLISHER_CENTS);
  });

  it("keeps the 70 cents/USD model unchanged around half-cent boundaries", () => {
    // reward is already user cents; currency is publisher USD converted to cents.
    expect(intendedUserCents("70")).toBe(70);
    expect(intendedPublisherCents("1.00")).toBe(100);
    expect(intendedPublisherCents("0.005")).toBe(1);
    expect(intendedPublisherCents("0.004999")).toBe(0);
    expect(intendedPublisherCents("0.014999")).toBe(1);
    expect(intendedPublisherCents("0.015")).toBe(2);
  });
});
