import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { COUNTRIES, COUNTRY_CODE_RE, isValidCountryCode, normalizeCountryCode } from "./countries";

describe("country codes (profiles.country is char(2))", () => {
  it("maps the required examples to ISO codes", () => {
    const byName = new Map(COUNTRIES.map((c) => [c.name, c.code]));
    expect(byName.get("United States")).toBe("US");
    expect(byName.get("India")).toBe("IN");
    expect(byName.get("United Kingdom")).toBe("GB");
    expect(byName.get("Germany")).toBe("DE");
    expect(byName.get("France")).toBe("FR");
  });

  it("every entry is a unique valid 2-letter code", () => {
    const codes = COUNTRIES.map((c) => c.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const code of codes) expect(COUNTRY_CODE_RE.test(code)).toBe(true);
  });

  it("normalizes to uppercase before submit", () => {
    expect(normalizeCountryCode("us")).toBe("US");
    expect(normalizeCountryCode(" De ")).toBe("DE");
    expect(normalizeCountryCode("GB")).toBe("GB");
  });

  it("accepts only /^[A-Z]{2}$/ values from the list", () => {
    expect(isValidCountryCode("US")).toBe(true);
    expect(isValidCountryCode("de")).toBe(true); // normalized, then valid
    expect(isValidCountryCode("United States")).toBe(false); // full name rejected
    expect(isValidCountryCode("Germany")).toBe(false);
    expect(isValidCountryCode("")).toBe(false);
    expect(isValidCountryCode("USA")).toBe(false);
    expect(isValidCountryCode("U")).toBe(false);
    expect(isValidCountryCode("XX")).toBe(false); // fallback code is not selectable
    expect(isValidCountryCode("12")).toBe(false);
    expect(isValidCountryCode("U1")).toBe(false);
  });
});

describe("migration 003 (defensive trigger)", () => {
  const sql = readFileSync(resolve(__dirname, "../database/migrations/003_defensive_signup_trigger.sql"), "utf8");

  it("keeps profiles.country as char(2) — no column widening", () => {
    expect(sql).not.toMatch(/alter table[^;]*profiles[^;]*type text/i);
    expect(sql).not.toMatch(/varchar\s*\(\s*(?!2\b)\d+/i);
  });

  it("accepts only 2-letter codes, uppercases, falls back to XX", () => {
    expect(sql).toMatch(/\^\[A-Z\]\{2\}\$/);
    expect(sql).toMatch(/upper\(v_raw\)/);
    expect(sql).toMatch(/'XX'/);
  });

  it("never aborts auth user creation and touches no RLS", () => {
    expect(sql).toMatch(/exception/i);
    expect(sql).not.toMatch(/create policy|drop policy|enable row level security/i);
  });
});
