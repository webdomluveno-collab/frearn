import { describe, expect, it } from "vitest";
import { parseDecimalToCents } from "../shared";

describe("parseDecimalToCents (exact, no floats)", () => {
  it("converts typical CPX values", () => {
    expect(parseDecimalToCents("1.40")).toBe(140);
    expect(parseDecimalToCents("2.00")).toBe(200);
    expect(parseDecimalToCents("0.65")).toBe(65);
    expect(parseDecimalToCents("0.5")).toBe(50);
    expect(parseDecimalToCents("10")).toBe(1000);
    expect(parseDecimalToCents(" 1.40 ")).toBe(140);
  });

  it("rejects float-dangerous and malformed input", () => {
    expect(parseDecimalToCents("1.405")).toBeNull; // over-precise
    expect(parseDecimalToCents("")).toBeNull;
    expect(parseDecimalToCents("abc")).toBeNull;
    expect(parseDecimalToCents("-1.40")).toBeNull; // negative
    expect(parseDecimalToCents("1,40")).toBeNull; // locale comma
    expect(parseDecimalToCents("NaN")).toBeNull;
    expect(parseDecimalToCents("1e3")).toBeNull;
    expect(parseDecimalToCents("99999999.99")).toBeNull; // unreasonably large
  });

  it("handles the classic 0.1+0.2 float trap exactly", () => {
    expect(parseDecimalToCents("0.10")).toBe(10);
    expect(parseDecimalToCents("0.20")).toBe(20);
    expect(10 + 20).toBe(30);
  });
});
