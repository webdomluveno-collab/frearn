import { describe, expect, it } from "vitest";
import {
  ACTIVE_WITHDRAWAL_METHODS,
  isActiveWithdrawalMethod,
  isValidDestination,
  isValidEmailDestination,
  isValidRevolutDestination,
  isValidSolanaAddress,
  isWithdrawableAmount,
  maskDestination,
  MINIMUM_WITHDRAWAL_CENTS,
  normalizeDestination,
  parseAmountCents,
} from "./withdrawals";

describe("withdrawal minimum", () => {
  it("is $3.00 / 300 cents", () => {
    expect(MINIMUM_WITHDRAWAL_CENTS).toBe(300);
  });

  it("accepts exactly 300 when the gate is met", () => {
    expect(isWithdrawableAmount(300)).toBe(true);
    expect(isWithdrawableAmount(299)).toBe(false);
  });

  it("rejects zero, negative, non-integer, and non-number amounts", () => {
    expect(isWithdrawableAmount(0)).toBe(false);
    expect(isWithdrawableAmount(-100)).toBe(false);
    expect(isWithdrawableAmount(300.5)).toBe(false);
    expect(isWithdrawableAmount(NaN)).toBe(false);
    expect(isWithdrawableAmount("300")).toBe(false);
    expect(isWithdrawableAmount(null)).toBe(false);
  });
});

describe("parseAmountCents", () => {
  it("parses display strings strictly", () => {
    expect(parseAmountCents("3")).toBe(300);
    expect(parseAmountCents("3.00")).toBe(300);
    expect(parseAmountCents("5.5")).toBe(550);
    expect(parseAmountCents(" 10.25 ")).toBe(1025);
  });

  it("rejects hostile and float-leaking input", () => {
    expect(parseAmountCents("")).toBe(null);
    expect(parseAmountCents("-3")).toBe(null);
    expect(parseAmountCents("3.001")).toBe(null);
    expect(parseAmountCents("abc")).toBe(null);
    expect(parseAmountCents("1e3")).toBe(null);
    expect(parseAmountCents("0x10")).toBe(null);
  });
});

describe("withdrawal methods", () => {
  it("activates exactly paypal, skrill, revolut, sol, usdc_solana", () => {
    expect([...ACTIVE_WITHDRAWAL_METHODS].sort()).toEqual(
      ["paypal", "revolut", "skrill", "sol", "usdc_solana"].sort()
    );
    expect(isActiveWithdrawalMethod("paypal")).toBe(true);
    expect(isActiveWithdrawalMethod("card")).toBe(false);
    expect(isActiveWithdrawalMethod("usdt")).toBe(false);
    expect(isActiveWithdrawalMethod("")).toBe(false);
  });

  it("card payout method can never be submitted", () => {
    expect(isActiveWithdrawalMethod("card")).toBe(false);
    expect(isValidDestination("card" as never, "4111")).toBe(false);
  });
});

describe("destination validation", () => {
  it("accepts PayPal/Skrill emails", () => {
    expect(isValidEmailDestination("user@example.com")).toBe(true);
    expect(isValidDestination("paypal", "user@example.com")).toBe(true);
    expect(isValidDestination("skrill", "User@Example.COM")).toBe(true);
  });

  it("rejects malformed emails", () => {
    for (const bad of ["", "a", "no-at-sign", "a@b", "a@b.c", "@x.com", "a b@c.com"]) {
      expect(isValidEmailDestination(bad)).toBe(false);
    }
    expect(isValidDestination("paypal", "")).toBe(false);
  });

  it("normalizes email case/whitespace", () => {
    expect(normalizeDestination("paypal", "  User@Example.COM ")).toBe("user@example.com");
  });

  it("accepts valid Revolut @usernames", () => {
    expect(isValidDestination("revolut", "@username")).toBe(true);
    expect(isValidDestination("revolut", "@fi_23.name")).toBe(true);
  });

  it("rejects invalid Revolut destinations", () => {
    const tooLong = `@${"x".repeat(31)}`;
    for (const bad of ["", "username", "@", "@a", tooLong, "@has space", "@bang!"]) {
      expect(isValidDestination("revolut", bad)).toBe(false);
    }
  });

  it("accepts valid Solana addresses for SOL and USDC", () => {
    const addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ";
    expect(addr.length).toBeGreaterThanOrEqual(32);
    expect(isValidDestination("sol", addr)).toBe(true);
    expect(isValidDestination("usdc_solana", addr)).toBe(true);
  });

  it("rejects other-chain formats", () => {
    expect(isValidDestination("sol", "0x1234567890abcdef1234567890abcdef12345678")).toBe(false);
    expect(isValidDestination("sol", "short")).toBe(false);
    expect(isValidDestination("sol", "0OIl+/=")).toBe(false);
    expect(isValidDestination("usdc_solana", "")).toBe(false);
  });
});

describe("maskDestination", () => {
  it("masks emails like f***@example.com", () => {
    expect(maskDestination("paypal", "freearn@example.com")).toBe("f***@example.com");
    expect(maskDestination("skrill", "ab@x.co")).toBe("a***@x.co");
  });

  it("masks Revolut handles like @fi***23", () => {
    expect(maskDestination("revolut", "@finance23")).toBe("@fi***23");
  });

  it("masks Solana addresses like ABC1…XYZ9", () => {
    expect(maskDestination("sol", "ABCDEF12XYZ9abcd")).toBe("ABCD…abcd");
  });

  it("never leaks short/garbage input", () => {
    expect(maskDestination("paypal", "x")).toBe("••••");
    expect(maskDestination("sol", "abc")).toBe("••••");
  });
});
