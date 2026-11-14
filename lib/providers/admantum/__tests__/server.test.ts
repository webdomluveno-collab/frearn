import { describe, expect, it, vi } from "vitest";
import { admantumCallbackHash, buildAdmantumWallUrl, verifyAdmantumCallback } from "../server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function withEnv(vars: Record<string, string | undefined>, run: () => void) {
  const keys = Object.keys(vars);
  const previous = Object.fromEntries(keys.map((key) => [key, process.env[key]]));
  try {
    for (const [key, value] of Object.entries(vars)) value === undefined ? delete process.env[key] : (process.env[key] = value);
    run();
  } finally {
    for (const key of keys) previous[key] === undefined ? delete process.env[key] : (process.env[key] = previous[key] as string);
  }
}

describe("AdMantum server signing", () => {
  it("uses the documented MD5 concatenation and timing-safe verification", () => {
    withEnv({ ADMANTUM_APP_ID: "987654", ADMANTUM_SECRET_KEY: "secret", ADMANTUM_CALLBACK_TOKEN: "token" }, () => {
      const hash = admantumCallbackHash(UID, "offer-1", "60");
      expect(verifyAdmantumCallback({ userId: UID, offerId: "offer-1", virtualCurrency: "60", transactionId: "tx-1", hash })).toBe(true);
      expect(verifyAdmantumCallback({ userId: UID, offerId: "offer-1", virtualCurrency: "61", transactionId: "tx-1", hash })).toBe(false);
    });
  });

  it("builds only the authenticated user's server URL", () => {
    withEnv({ ADMANTUM_APP_ID: "987654", ADMANTUM_SECRET_KEY: "secret" }, () => {
      const url = new URL(buildAdmantumWallUrl(UID));
      expect(url.origin).toBe("https://www.admantum.com");
      expect(url.pathname).toBe("/offers");
      expect(url.searchParams.get("appid")).toBe("987654");
      expect(url.searchParams.get("uid")).toBe(UID);
      expect(url.toString()).not.toContain("secret");
    });
  });
});
