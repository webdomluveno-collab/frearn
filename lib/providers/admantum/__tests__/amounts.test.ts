import { describe, expect, it } from "vitest";
import { parseAdmantumVirtualCurrency, providerRevenueCentsFromVirtualCurrency } from "../amounts";

describe("AdMantum 60-unit money mapping", () => {
  it("uses virtual_currency as user cents without a second 60% reduction", () => {
    expect(parseAdmantumVirtualCurrency("30")).toBe(BigInt(30));
    expect(parseAdmantumVirtualCurrency("60")).toBe(BigInt(60));
    expect(parseAdmantumVirtualCurrency("300")).toBe(BigInt(300));
  });

  it("derives provider revenue with exact integer rational arithmetic", () => {
    expect(providerRevenueCentsFromVirtualCurrency(BigInt(60))).toBe(100);
    expect(providerRevenueCentsFromVirtualCurrency(BigInt(300))).toBe(500);
    expect(parseAdmantumVirtualCurrency("1.5")).toBeNull();
    expect(parseAdmantumVirtualCurrency("-1")).toBeNull();
  });
});
