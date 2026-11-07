import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  buildOfferwallggPreviewUrl,
  buildOfferwallggSignedUserUrl,
  isOfferwallggConfigured,
  isOfferwallggPreviewEnabled,
  signOfferwallggQuery,
  verifyOfferwallggCallback,
} from "../server";

const KEY = "0123456789abcdef0123456789abcdef";
const SECRET = "test-secret-for-offerwallgg";
const USER = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const keys = ["OFFERWALLGG_PUBLIC_KEY", "OFFERWALLGG_SECRET_KEY", "OFFERWALLGG_PREVIEW_ENABLED", "OFFERWALLGG_LINK_EXPIRY_ENABLED"];
  const prev: Record<string, string | undefined> = {};
  for (const k of keys) prev[k] = process.env[k];
  try {
    for (const k of keys) {
      const v = vars[k];
      if (v === undefined) delete process.env[k];
      else process.env[k] = v;
    }
    run();
  } finally {
    for (const k of keys) {
      if (prev[k] === undefined) delete process.env[k];
      else process.env[k] = prev[k];
    }
  }
}

const ENV = { OFFERWALLGG_PUBLIC_KEY: KEY, OFFERWALLGG_SECRET_KEY: SECRET, OFFERWALLGG_PREVIEW_ENABLED: "true" };

describe("Offerwall.GG safe preview and signing", () => {
  it("fails closed without both credentials and an explicit preview switch", () => {
    withEnv({}, () => {
      expect(isOfferwallggConfigured()).toBe(false);
      expect(isOfferwallggPreviewEnabled()).toBe(false);
    });
    withEnv({ ...ENV, OFFERWALLGG_PREVIEW_ENABLED: undefined }, () => {
      expect(isOfferwallggConfigured()).toBe(true);
      expect(isOfferwallggPreviewEnabled()).toBe(false);
    });
    withEnv({ ...ENV, OFFERWALLGG_PUBLIC_KEY: "invalid" }, () => {
      expect(isOfferwallggConfigured()).toBe(false);
    });
  });

  it("signs the exact sorted, URL-encoded parameters using HMAC-SHA256 hex", () => {
    withEnv(ENV, () => {
      const expected = createHmac("sha256", SECRET)
        .update("appId=" + KEY + "&userId=" + encodeURIComponent(USER), "utf8")
        .digest("hex");
      expect(signOfferwallggQuery({ userId: USER, appId: KEY })).toBe(expected);
    });
  });

  it("preview never contains an attributable userId or secret", () => {
    withEnv(ENV, () => {
      const url = new URL(buildOfferwallggPreviewUrl());
      expect(url.origin).toBe("https://offerwall.gg");
      expect(url.pathname).toBe("/wall/" + KEY);
      expect(url.searchParams.has("userId")).toBe(false);
      expect(url.searchParams.get("signature")).toMatch(/^[a-f0-9]{64}$/);
      expect(url.toString()).not.toContain(SECRET);
    });
  });

  it("includes ts within the signature when expiring links are requested", () => {
    withEnv({ ...ENV, OFFERWALLGG_LINK_EXPIRY_ENABLED: "true" }, () => {
      const url = new URL(buildOfferwallggPreviewUrl());
      const ts = url.searchParams.get("ts");
      expect(ts).toMatch(/^\d{10}$/);
      const expected = signOfferwallggQuery({ appId: KEY, ts: ts as string });
      expect(url.searchParams.get("signature")).toBe(expected);
    });
  });

  it("can build a separately signed per-user URL for later audited launch", () => {
    withEnv(ENV, () => {
      const url = new URL(buildOfferwallggSignedUserUrl(USER));
      expect(url.searchParams.get("userId")).toBe(USER);
      expect(url.searchParams.get("signature")).toBe(signOfferwallggQuery({ appId: KEY, userId: USER }));
      expect(() => buildOfferwallggSignedUserUrl("another-user")).toThrow();
    });
  });

  it("verifies callback HMAC using RAW signed amount including fractional precision", () => {
    withEnv(ENV, () => {
      const amount = "1750.2857";
      const transactionId = "e794d89342e0c468f6dd81205999425b";
      const sig = createHmac("sha256", SECRET).update(USER + ":" + transactionId + ":" + amount).digest("hex");
      const fields = { userId: USER, transactionId, currencyAmount: amount, signature: sig };
      expect(verifyOfferwallggCallback(fields)).toBe(true);
      expect(verifyOfferwallggCallback({ ...fields, currencyAmount: "1750.2856" })).toBe(false);
      expect(verifyOfferwallggCallback({ ...fields, currencyAmount: "1750.28570" })).toBe(false);
      expect(verifyOfferwallggCallback({ ...fields, userId: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff" })).toBe(false);
      expect(verifyOfferwallggCallback({ ...fields, signature: "a" + sig.slice(1) })).toBe(false);
    });
  });
});
