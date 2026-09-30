import { describe, expect, it } from "vitest";
import {
  normalizePostback,
  parseCurrencyToCents,
  parseRevenueToCents,
  validatePostbackShape,
  type TimewallPostbackParams,
} from "../shared";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function params(overrides: Partial<TimewallPostbackParams> = {}): TimewallPostbackParams {
  return {
    userid: UID,
    txid: "tw-001",
    revenueRaw: "1.00",
    currencyRaw: "70",
    hash: "a".repeat(64),
    type: "0",
    ...overrides,
  };
}

describe("parseRevenueToCents (exact decimal dollars, no floats)", () => {
  it("parses typical TimeWall values", () => {
    expect(parseRevenueToCents("1.00")).toBe(100);
    expect(parseRevenueToCents("0.10")).toBe(10);
    expect(parseRevenueToCents("0.5")).toBe(50);
    expect(parseRevenueToCents("2")).toBe(200);
  });

  it("handles sub-cent revenue exactly (0.002 USD -> 0 cents, not an error)", () => {
    expect(parseRevenueToCents("0.002")).toBe(0);
    expect(parseRevenueToCents("0.009")).toBe(1);
    expect(parseRevenueToCents("0.005")).toBe(1);
    expect(parseRevenueToCents("0.004")).toBe(0);
  });

  it("rejects malformed revenue", () => {
    expect(parseRevenueToCents("")).toBeNull();
    expect(parseRevenueToCents("abc")).toBeNull();
    expect(parseRevenueToCents("-1.00")).toBeNull();
    expect(parseRevenueToCents("1,00")).toBeNull();
    expect(parseRevenueToCents("1.1234567")).toBeNull(); // >6 decimals
    expect(parseRevenueToCents("99999999.99")).toBeNull(); // unreasonably large
    expect(parseRevenueToCents("NaN")).toBeNull();
  });
});

describe("parseCurrencyToCents (integer cents only, verbatim)", () => {
  it("accepts whole-cent values", () => {
    expect(parseCurrencyToCents("70")).toBe(70);
    expect(parseCurrencyToCents("7")).toBe(7);
    expect(parseCurrencyToCents("0")).toBe(0);
  });

  it("rejects anything that is not a plain non-negative integer", () => {
    expect(parseCurrencyToCents("")).toBeNull();
    expect(parseCurrencyToCents("70.0")).toBeNull();
    expect(parseCurrencyToCents("70.5")).toBeNull();
    expect(parseCurrencyToCents("-5")).toBeNull();
    expect(parseCurrencyToCents("abc")).toBeNull();
    expect(parseCurrencyToCents(" 70")).toBe(70); // surrounding spaces are trimmed, then exact
    expect(parseCurrencyToCents("99999999")).toBeNull();
  });
});

describe("validatePostbackShape", () => {
  it("accepts a well-formed TimeWall callback", () => {
    expect(validatePostbackShape(params())).toEqual({ ok: true });
  });

  it("rejects bad identity fields", () => {
    expect(validatePostbackShape(params({ userid: "not-a-uuid" })).ok).toBe(false);
    expect(validatePostbackShape(params({ userid: "user@example.com" })).ok).toBe(false);
    expect(validatePostbackShape(params({ txid: "" })).ok).toBe(false);
    expect(validatePostbackShape(params({ txid: "a".repeat(129) })).ok).toBe(false);
  });

  it("rejects malformed money fields", () => {
    expect(validatePostbackShape(params({ revenueRaw: "abc" })).ok).toBe(false);
    expect(validatePostbackShape(params({ currencyRaw: "7.5" })).ok).toBe(false);
    expect(validatePostbackShape(params({ hash: "xyz" })).ok).toBe(false);
    expect(validatePostbackShape(params({ hash: "a".repeat(63) })).ok).toBe(false);
  });

  it("requires a non-empty type but does not judge its value (process decides)", () => {
    expect(validatePostbackShape(params({ type: "" })).ok).toBe(false);
    expect(validatePostbackShape(params({ type: "anything-at-all" })).ok).toBe(true);
  });
});

describe("normalizePostback", () => {
  it("separates revenue from currency with NO multiplier applied", () => {
    const n = normalizePostback(params({ revenueRaw: "1.00", currencyRaw: "70" }));
    expect(n.revenueCents).toBe(100);
    expect(n.userRewardCents).toBe(70); // NOT 49 — no second 70% multiplier
    expect(n.revenueRaw).toBe("1.00");
  });

  it("keeps the dashboard example exact: $0.10 revenue -> 7 cents", () => {
    const n = normalizePostback(params({ revenueRaw: "0.10", currencyRaw: "7" }));
    expect(n.revenueCents).toBe(10);
    expect(n.userRewardCents).toBe(7);
  });

  it("truncates overlong optional metadata fields", () => {
    const n = normalizePostback(params({ offername: "x".repeat(500), reason: "y".repeat(500) }));
    expect(n.offername!.length).toBe(128);
    expect(n.reason!.length).toBe(256);
  });
});
