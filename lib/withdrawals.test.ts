import { describe, expect, it } from "vitest";
import { METHOD_CASES } from "./withdrawals/__tests__/cases";
import {
  ACTIVE_WITHDRAWAL_METHODS,
  PAYOUT_RULES,
  isKnownWithdrawalMethod,
  isActiveWithdrawalMethod,
  isValidDestination,
  isValidEmailDestination,
  isValidRevolutDestination,
  isValidSolanaAddress,
  isWithdrawableAmount,
  maskDestination,
  LOWEST_WITHDRAWAL_CENTS,
  normalizeDestination,
  parseAmountCents,
} from "./withdrawals";

describe("withdrawal minimum", () => {
  it("is $0.10 / 10 cents", () => {
    expect(LOWEST_WITHDRAWAL_CENTS).toBe(10);
  });

  it("accepts exactly 10 when the gate is met", () => {
    expect(isWithdrawableAmount("revolut", 10)).toBe(true);
    expect(isWithdrawableAmount("revolut", 9)).toBe(false);
  });

  it("rejects zero, negative, non-integer, and non-number amounts", () => {
    expect(isWithdrawableAmount("revolut", 0)).toBe(false);
    expect(isWithdrawableAmount("revolut", -100)).toBe(false);
    expect(isWithdrawableAmount("revolut", 300.5)).toBe(false);
    expect(isWithdrawableAmount("revolut", NaN)).toBe(false);
    expect(isWithdrawableAmount("revolut", "300")).toBe(false);
    expect(isWithdrawableAmount("revolut", null)).toBe(false);
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
  it("activates six supported methods and retires Skrill", () => {
    expect([...ACTIVE_WITHDRAWAL_METHODS].sort()).toEqual(
      ["paypal", "revolut", "ltc", "sol", "usdc_solana", "usdc_bep20"].sort()
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
  it("accepts PayPal emails and rejects retired Skrill", () => {
    expect(isValidEmailDestination("user@example.com")).toBe(true);
    expect(isValidDestination("paypal", "user@example.com")).toBe(true);
    expect(isValidDestination("skrill", "User@Example.COM")).toBe(false);
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

describe("method-specific shared policy", () => {
  it.each(METHOD_CASES)("$method rejects one cent below $minimum cents", ({method,minimum}) => {
    expect(PAYOUT_RULES[method].minimumCents).toBe(minimum);
    expect(isWithdrawableAmount(method,minimum-1)).toBe(false);
  });
  it.each(METHOD_CASES)("$method permits exactly $minimum cents", ({method,minimum,destination}) => {
    expect(isWithdrawableAmount(method,minimum)).toBe(true);
    expect(isValidDestination(method,destination)).toBe(true);
  });
  it.each(["skrill","card","unknown",null,"toString","__proto__"])("rejects disabled or unknown %s", method => {
    expect(isActiveWithdrawalMethod(method)).toBe(false);
    expect(isWithdrawableAmount(method,1000)).toBe(false);
  });
  it("retains known Skrill metadata for history", () => {
    expect(isKnownWithdrawalMethod("skrill")).toBe(true);
    expect(PAYOUT_RULES.skrill.enabled).toBe(false);
    expect(maskDestination("skrill","old@example.com")).toBe("o***@example.com");
  });
  it("rejects unsafe/DB-overflow amounts", () => {
    expect(isWithdrawableAmount("paypal",2147483648)).toBe(false);
    expect(isWithdrawableAmount("paypal",Number.MAX_SAFE_INTEGER+1)).toBe(false);
  });
  it("keeps BEP20 case and rejects malformed or wrong-chain destinations", () => {
    const address="0x1234567890aBCdef1234567890abcdef12345678";
    expect(isValidDestination("usdc_bep20",address)).toBe(true);
    expect(normalizeDestination("usdc_bep20",` ${address} `)).toBe(address);
    for(const bad of ["0xabc","0x"+"g".repeat(40),METHOD_CASES[3].destination]) expect(isValidDestination("usdc_bep20",bad)).toBe(false);
  });
  it("accepts Litecoin mainnet shapes, rejects testnet, other chains and MWEB", () => {
    for(const good of [METHOD_CASES[2].destination,"M"+"a".repeat(33),"ltc1q"+"a".repeat(38)]) expect(isValidDestination("ltc",good)).toBe(true);
    for(const bad of ["1"+"a".repeat(33),"tltc1q"+"a".repeat(38),"ltc1mweb"+"a".repeat(90),METHOD_CASES[5].destination,"short"]) expect(isValidDestination("ltc",bad)).toBe(false);
  });
});
