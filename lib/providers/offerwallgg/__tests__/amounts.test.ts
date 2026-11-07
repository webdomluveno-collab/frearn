import { describe, expect, it } from "vitest";
import { apiUnits4, decimalUnits4, payoutUsdCents } from "../amounts";

describe("Offerwall.GG precision without double 60% allocation", () => {
  it.each([
    ["60", BigInt(600000)],
    ["70", BigInt(700000)],
    ["0.0001", BigInt(1)],
    ["0.42", BigInt(4200)],
    ["12.3456", BigInt(123456)],
    ["-12.3456", -BigInt(123456)],
  ])("keeps the exact signed units in cents %s", (value, expected) => {
    expect(decimalUnits4(value)).toBe(expected);
  });
  it.each(["", "0", "-0.0000", "1e3", "1.12345", "1000001", "NaN", "1,2"])("rejects invalid amount %s", (value) => {
    expect(decimalUnits4(value)).toBeNull();
  });
  it("matches API numeric values including historical 70-unit rewards", () => {
    expect(apiUnits4(60.125)).toBe(BigInt(601250));
    expect(apiUnits4(70)).toBe(BigInt(700000));
    expect(apiUnits4(-60.5)).toBe(-BigInt(605000));
  });
  it("rounds authenticated publisher USD to cents", () => {
    expect(payoutUsdCents(1)).toBe(100);
    expect(payoutUsdCents(0.005)).toBe(1);
    expect(payoutUsdCents(0.004999)).toBe(0);
    expect(payoutUsdCents(-1)).toBeNull();
  });
});
