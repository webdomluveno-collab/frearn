import { describe, expect, it } from "vitest";
import { apiUnits4, decimalUnits4, payoutUsdCents } from "../amounts";

describe("Offerwall.GG precision without double 60% allocation", () => {
  it.each([
    ["60", 600000n],
    ["70", 700000n],
    ["0.0001", 1n],
    ["0.42", 4200n],
    ["12.3456", 123456n],
    ["-12.3456", -123456n],
  ])("keeps the exact signed units in cents %s", (value, expected) => {
    expect(decimalUnits4(value)).toBe(expected);
  });
  it.each(["", "0", "-0.0000", "1e3", "1.12345", "1000001", "NaN", "1,2"])("rejects invalid amount %s", (value) => {
    expect(decimalUnits4(value)).toBeNull();
  });
  it("matches API numeric values including historical 70-unit rewards", () => {
    expect(apiUnits4(60.125)).toBe(601250n);
    expect(apiUnits4(70)).toBe(700000n);
    expect(apiUnits4(-60.5)).toBe(-605000n);
  });
  it("rounds authenticated publisher USD to cents", () => {
    expect(payoutUsdCents(1)).toBe(100);
    expect(payoutUsdCents(0.005)).toBe(1);
    expect(payoutUsdCents(0.004999)).toBe(0);
    expect(payoutUsdCents(-1)).toBeNull();
  });
});
