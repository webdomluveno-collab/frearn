import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";

const TEST_SECRET = "test-timewall-secret-456";
const USER_ID = "11111111-2222-3333-4444-555555555555";

async function withSecret(secret: string | undefined, fn: () => Promise<void>): Promise<void> {
  const prevSecret = process.env.TIMEWALL_POSTBACK_SECRET;
  const prevEnabled = process.env.TIMEWALL_POSTBACK_ENABLED;
  if (secret === undefined) delete process.env.TIMEWALL_POSTBACK_SECRET;
  else process.env.TIMEWALL_POSTBACK_SECRET = secret;
  process.env.TIMEWALL_POSTBACK_ENABLED = "true";
  try {
    await fn();
  } finally {
    if (prevSecret === undefined) delete process.env.TIMEWALL_POSTBACK_SECRET;
    else process.env.TIMEWALL_POSTBACK_SECRET = prevSecret;
    if (prevEnabled === undefined) delete process.env.TIMEWALL_POSTBACK_ENABLED;
    else process.env.TIMEWALL_POSTBACK_ENABLED = prevEnabled;
  }
}

function sha256Hex(input: string): string {
  return createHash("sha256").update(input, "utf8").digest("hex");
}

describe("TimeWall hashes (deterministic test secret)", () => {
  it("verifies SHA256(userid + revenue_raw + secret) with exact raw strings", async () => {
    await withSecret(TEST_SECRET, async () => {
      const { verifyTimewallHash } = await import("../server");
      const hash = sha256Hex(`${USER_ID}1.00${TEST_SECRET}`);
      expect(verifyTimewallHash(USER_ID, "1.00", hash)).toBe(true);
    });
  });

  it("0.5 and 0.50 are DIFFERENT signed inputs (exact-raw requirement)", async () => {
    await withSecret(TEST_SECRET, async () => {
      const { verifyTimewallHash } = await import("../server");
      const hashForDot5 = sha256Hex(`${USER_ID}0.5${TEST_SECRET}`);
      const hashForDot50 = sha256Hex(`${USER_ID}0.50${TEST_SECRET}`);
      expect(hashForDot5).not.toBe(hashForDot50);
      // A hash minted over "0.5" must NOT verify a "0.50" callback and vice versa.
      expect(verifyTimewallHash(USER_ID, "0.5", hashForDot5)).toBe(true);
      expect(verifyTimewallHash(USER_ID, "0.50", hashForDot5)).toBe(false);
      expect(verifyTimewallHash(USER_ID, "0.50", hashForDot50)).toBe(true);
      expect(verifyTimewallHash(USER_ID, "0.5", hashForDot50)).toBe(false);
    });
  });

  it("rejects wrong hash, wrong revenue, and wrong user", async () => {
    await withSecret(TEST_SECRET, async () => {
      const { verifyTimewallHash } = await import("../server");
      const hash = sha256Hex(`${USER_ID}1.00${TEST_SECRET}`);
      expect(verifyTimewallHash(USER_ID, "1.00", "0".repeat(64))).toBe(false);
      expect(verifyTimewallHash(USER_ID, "2.00", hash)).toBe(false);
      expect(verifyTimewallHash("22222222-2222-2222-2222-222222222222", "1.00", hash)).toBe(false);
    });
  });

  it("fails closed without a secret or without a hash", async () => {
    await withSecret(undefined, async () => {
      const { isTimewallConfigured, verifyTimewallHash } = await import("../server");
      expect(isTimewallConfigured()).toBe(false);
      expect(verifyTimewallHash(USER_ID, "1.00", "a".repeat(64))).toBe(false);
    });
    await withSecret(TEST_SECRET, async () => {
      const { verifyTimewallHash } = await import("../server");
      expect(verifyTimewallHash(USER_ID, "1.00", "")).toBe(false);
      expect(verifyTimewallHash(USER_ID, "1.00", "not-hex")).toBe(false);
      expect(verifyTimewallHash(USER_ID, "1.00", "abc")).toBe(false);
    });
  });
});
