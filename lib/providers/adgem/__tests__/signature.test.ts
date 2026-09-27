import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";

const KEY = "test-adgem-key-abc";

function sign(raw: string): string {
  return createHmac("sha256", KEY).update(Buffer.from(raw, "utf8")).digest("hex");
}

describe("AdGem v3 signature (deterministic test key)", () => {
  it("accepts HMAC-SHA256 over the exact raw body", async () => {
    process.env.ADGEM_POSTBACK_KEY = KEY;
    try {
      const { verifyAdgemSignature } = await import("../server");
      const raw = '{"request_id":"r-1","timestamp":1748365518,"data":{"a":1}}';
      expect(verifyAdgemSignature(raw, sign(raw))).toBe(true);
    } finally {
      delete process.env.ADGEM_POSTBACK_KEY;
    }
  });

  it("rejects modified body with old signature", async () => {
    process.env.ADGEM_POSTBACK_KEY = KEY;
    try {
      const { verifyAdgemSignature } = await import("../server");
      const raw = '{"request_id":"r-1","timestamp":1748365518}';
      const tampered = '{"request_id":"r-1","timestamp":1748365519}';
      // Even a single-byte change (whitespace included) must fail.
      expect(verifyAdgemSignature(tampered, sign(raw))).toBe(false);
      expect(verifyAdgemSignature(raw + " ", sign(raw))).toBe(false);
    } finally {
      delete process.env.ADGEM_POSTBACK_KEY;
    }
  });

  it("rejects wrong, missing, and malformed signatures", async () => {
    process.env.ADGEM_POSTBACK_KEY = KEY;
    try {
      const { verifyAdgemSignature } = await import("../server");
      const raw = '{"request_id":"r-1"}';
      expect(verifyAdgemSignature(raw, "0".repeat(64))).toBe(false);
      expect(verifyAdgemSignature(raw, null)).toBe(false);
      expect(verifyAdgemSignature(raw, "")).toBe(false);
      expect(verifyAdgemSignature(raw, "not-hex-at-all!!")).toBe(false);
    } finally {
      delete process.env.ADGEM_POSTBACK_KEY;
    }
  });

  it("fails closed without ADGEM_POSTBACK_KEY", async () => {
    delete process.env.ADGEM_POSTBACK_KEY;
    const { verifyAdgemSignature, isAdgemConfigured } = await import("../server");
    expect(isAdgemConfigured()).toBe(false);
    expect(verifyAdgemSignature('{"a":1}', "0".repeat(64))).toBe(false);
  });
});
