import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const TEST_SECRET = "test-app-secret-123";
const USER_ID = "11111111-2222-3333-4444-555555555555";

async function withSecret<T>(secret: string | undefined, fn: () => Promise<T> | T): Promise<T> {
  const prevSecure = process.env.CPX_APP_SECURE_HASH;
  const prevPostback = process.env.CPX_POSTBACK_SECRET;
  const prevEnabled = process.env.CPX_POSTBACK_ENABLED;
  if (secret === undefined) delete process.env.CPX_APP_SECURE_HASH;
  else process.env.CPX_APP_SECURE_HASH = secret;
  delete process.env.CPX_POSTBACK_SECRET;
  process.env.CPX_POSTBACK_ENABLED = "true";
  try {
    return await fn();
  } finally {
    if (prevSecure === undefined) delete process.env.CPX_APP_SECURE_HASH;
    else process.env.CPX_APP_SECURE_HASH = prevSecure;
    if (prevPostback === undefined) delete process.env.CPX_POSTBACK_SECRET;
    else process.env.CPX_POSTBACK_SECRET = prevPostback;
    if (prevEnabled === undefined) delete process.env.CPX_POSTBACK_ENABLED;
    else process.env.CPX_POSTBACK_ENABLED = prevEnabled;
  }
}

describe("CPX hashes (deterministic test secret)", () => {
  it("builds the documented wall hash MD5(ext_user_id + '-' + secret)", async () => {
    await withSecret(TEST_SECRET, async () => {
      const { cpxWallHash } = await import("../server");
      const expected = createHash("md5").update(`${USER_ID}-${TEST_SECRET}`, "utf8").digest("hex");
      expect(cpxWallHash(USER_ID)).toBe(expected);
    });
  });

  it("verifies a correct postback signature and rejects a wrong one", async () => {
    await withSecret(TEST_SECRET, async () => {
      const { expectedPostbackHash, verifyPostbackHash } = await import("../server");
      const transId = "cpx-txn-abc-123";
      // Authoritative CPX formula: MD5("{trans_id}-{secret}")
      const good = createHash("md5").update(`${transId}-${TEST_SECRET}`, "utf8").digest("hex");
      expect(expectedPostbackHash(transId)).toBe(good);
      expect(verifyPostbackHash(transId, good)).toBe(true);
      expect(verifyPostbackHash(transId, good.toUpperCase())).toBe(true);
      expect(verifyPostbackHash(transId, "0".repeat(32))).toBe(false);
      expect(verifyPostbackHash("other-txn", good)).toBe(false);
      // The old non-hyphenated formula must NOT verify.
      const legacy = createHash("md5").update(`${transId}${TEST_SECRET}`, "utf8").digest("hex");
      expect(verifyPostbackHash(transId, legacy)).toBe(false);
    });
  });

  it("fails closed without a secret", async () => {
    await withSecret(undefined, async () => {
      const { verifyPostbackHash, buildSurveyWallUrl, isCpxConfigured } = await import("../server");
      expect(isCpxConfigured()).toBe(false);
      expect(verifyPostbackHash("any", "any")).toBe(false);
      expect(() => buildSurveyWallUrl({ extUserId: USER_ID })).toThrow();
    });
  });

  it("wall URL carries the per-user hash but never the secret", async () => {
    await withSecret(TEST_SECRET, async () => {
      const { buildSurveyWallUrl } = await import("../server");
      const url = buildSurveyWallUrl({ extUserId: USER_ID, email: "user@example.com" });
      expect(url).toContain("app_id=36592");
      expect(url).toContain(`ext_user_id=${USER_ID}`);
      expect(url).toContain("secure_hash=");
      expect(url).not.toContain(TEST_SECRET);
      expect(url).not.toContain("CPX_APP_SECURE_HASH");
    });
  });
});
