import { describe, expect, it } from "vitest";
import {
  callbackTxId,
  intendedPublisherCents,
  intendedUserCents,
  isDebugTrue,
  isReasonableId,
  isReversalTrue,
  isUuid,
  readCallbackFields,
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

  it("prefers tx_id but captures transaction_id (identity unresolved)", () => {
    expect(callbackTxId({ txId: "tx-1", transactionId: "entry-1" })).toBe("tx-1");
    expect(callbackTxId({ txId: null, transactionId: "entry-1" })).toBe("entry-1");
    expect(callbackTxId({ txId: "", transactionId: null })).toBe(null);
    expect(callbackTxId({ txId: null, transactionId: null })).toBe(null);
  });

  it("reads all callback fields including deprecated status (never trusted)", () => {
    const params = new URLSearchParams({
      reward: "70",
      currency: "1.00",
      user_id: UID,
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
  });
});

describe("TheoremReach intended money mapping (DOCUMENT ONLY — Phase 1 writes nothing)", () => {
  it("reward=70 maps to 70 user cents with NO second multiplier", () => {
    expect(intendedUserCents(70)).toBe(70);
    // NOT 49: no 70% reapplication, ever.
    expect(intendedUserCents(70)).not.toBe(49);
  });

  it("rejects non-creditable reward shapes", () => {
    expect(intendedUserCents(70.5)).toBe(null);
    expect(intendedUserCents(0)).toBe(null);
    expect(intendedUserCents(-10)).toBe(null);
    expect(intendedUserCents(NaN)).toBe(null);
    expect(intendedUserCents("70")).toBe(null);
    expect(intendedUserCents(THEOREMREACH_MAX_REWARD_CENTS + 1)).toBe(null);
  });

  it("currency=1.00 maps to 100 publisher cents", () => {
    expect(intendedPublisherCents(1.0)).toBe(100);
    expect(intendedPublisherCents(3.31)).toBe(331);
    expect(intendedPublisherCents(-1)).toBe(null);
    expect(intendedPublisherCents(NaN)).toBe(null);
    expect(intendedPublisherCents("1.00")).toBe(null);
  });
});
