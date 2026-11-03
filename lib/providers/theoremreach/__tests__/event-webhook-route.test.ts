import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/providers/theoremreach/event-webhook/route";
import {
  theoremreachCallbackEndpoint,
  theoremreachCallbackHash,
  theoremreachEventWebhookEndpoint,
} from "../server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const SECRET = "test-theoremreach-event-secret";
const EVENT_ID = "event-123";

const mocks = vi.hoisted(() => ({
  processReversalAtomically: vi.fn(),
  processBanAtomically: vi.fn(),
}));

vi.mock("@/lib/db/theoremreach-store", () => ({
  SupabaseTheoremreachStore: class {
    processReversalAtomically = mocks.processReversalAtomically;
    processBanAtomically = mocks.processBanAtomically;
  },
}));

function saveEnv() {
  return {
    secret: process.env.THEOREMREACH_SECRET_KEY,
    master: process.env.THEOREMREACH_EVENT_WEBHOOK_ENABLED,
    processing: process.env.THEOREMREACH_EVENT_PROCESSING_ENABLED,
    apiKey: process.env.THEOREMREACH_API_KEY,
  };
}

function restoreEnv(prev: ReturnType<typeof saveEnv>) {
  for (const [key, value] of [
    ["THEOREMREACH_SECRET_KEY", prev.secret],
    ["THEOREMREACH_EVENT_WEBHOOK_ENABLED", prev.master],
    ["THEOREMREACH_EVENT_PROCESSING_ENABLED", prev.processing],
    ["THEOREMREACH_API_KEY", prev.apiKey],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enable() {
  process.env.THEOREMREACH_SECRET_KEY = SECRET;
  process.env.THEOREMREACH_EVENT_WEBHOOK_ENABLED = "true";
  process.env.THEOREMREACH_EVENT_PROCESSING_ENABLED = "true";
}

function signedUrl(body: string, eventId = EVENT_ID, path = theoremreachEventWebhookEndpoint()): string {
  const unsigned = `${path}?enc_salt=${encodeURIComponent(eventId)}`;
  return `${unsigned}&hash=${theoremreachCallbackHash(unsigned)}`;
}

function request(url: string, body: string): Request {
  return new Request(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body,
  });
}

function reversalBody(extra: Record<string, unknown> = {}): string {
  return JSON.stringify({
    data: {
      event_type: "reversal",
      user_id: UID,
      reversed_transactions: [{ transaction_id: "tr-1", amount_in_currency: "1.0" }],
      ...extra,
    },
  });
}

describe("POST /api/providers/theoremreach/event-webhook", () => {
  beforeEach(() => {
    mocks.processReversalAtomically.mockReset();
    mocks.processBanAtomically.mockReset();
  });

  it("503 when the Event Webhook master switch is off", async () => {
    const prev = saveEnv();
    process.env.THEOREMREACH_SECRET_KEY = SECRET;
    delete process.env.THEOREMREACH_EVENT_WEBHOOK_ENABLED;
    try {
      const body = reversalBody();
      expect((await POST(request(signedUrl(body), body))).status).toBe(503);
      expect(mocks.processReversalAtomically).not.toHaveBeenCalled();
    } finally {
      restoreEnv(prev);
    }
  });

  it("503 when the write gate is off", async () => {
    const prev = saveEnv();
    enable();
    process.env.THEOREMREACH_EVENT_PROCESSING_ENABLED = "false";
    try {
      const body = reversalBody();
      expect((await POST(request(signedUrl(body), body))).status).toBe(503);
      expect(mocks.processReversalAtomically).not.toHaveBeenCalled();
    } finally {
      restoreEnv(prev);
    }
  });

  it("403 on a bad signature before any store construction", async () => {
    const prev = saveEnv();
    enable();
    try {
      const body = reversalBody();
      const url = signedUrl(body).replace(/hash=[^&]+$/, "hash=AAAAAAAAAAAAAAAAAAAAAAAAAAA");
      expect((await POST(request(url, body))).status).toBe(403);
      expect(mocks.processReversalAtomically).not.toHaveBeenCalled();
    } finally {
      restoreEnv(prev);
    }
  });

  it("rejects the postback path as an Event Webhook", async () => {
    const prev = saveEnv();
    enable();
    try {
      const body = reversalBody();
      expect((await POST(request(signedUrl(body, EVENT_ID, theoremreachCallbackEndpoint()), body))).status).toBe(400);
      expect(mocks.processReversalAtomically).not.toHaveBeenCalled();
    } finally {
      restoreEnv(prev);
    }
  });

  it("processes a signed reversal once and acknowledges only durable outcomes", async () => {
    const prev = saveEnv();
    enable();
    mocks.processReversalAtomically.mockResolvedValue({ outcome: "reversed", ledgerId: "ledger-1" });
    try {
      const body = reversalBody();
      const res = await POST(request(signedUrl(body), body));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1");
      expect(mocks.processReversalAtomically).toHaveBeenCalledTimes(1);
      expect(mocks.processReversalAtomically).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        userId: UID,
        txId: "tr-1",
        rawPayload: expect.objectContaining({ tx_id: "tr-1", event_type: "reversal" }),
      });
    } finally {
      restoreEnv(prev);
    }
  });

  it("acknowledges duplicate and orphan reversals as durable no-ops", async () => {
    const prev = saveEnv();
    enable();
    try {
      for (const outcome of ["duplicate", "orphan_reversal"] as const) {
        mocks.processReversalAtomically.mockResolvedValueOnce({ outcome, ledgerId: null });
        const body = reversalBody();
        expect((await POST(request(signedUrl(body), body))).status).toBe(200);
      }
    } finally {
      restoreEnv(prev);
    }
  });

  it("processes a signed ban event", async () => {
    const prev = saveEnv();
    enable();
    mocks.processBanAtomically.mockResolvedValue({ outcome: "banned" });
    try {
      const body = JSON.stringify({
        data: { event_type: "ban", user_id: UID, ban_reason: "violation of terms" },
      });
      const res = await POST(request(signedUrl(body), body));
      expect(res.status).toBe(200);
      expect(mocks.processBanAtomically).toHaveBeenCalledWith({
        eventId: EVENT_ID,
        userId: UID,
        reason: "violation of terms",
        rawPayload: expect.objectContaining({ event_type: "ban" }),
      });
    } finally {
      restoreEnv(prev);
    }
  });

  it("400 on malformed bodies and invalid reversed transaction shapes", async () => {
    const prev = saveEnv();
    enable();
    try {
      const cases = [
        "not-json",
        JSON.stringify({}),
        JSON.stringify({ data: { event_type: "unknown", user_id: UID } }),
        JSON.stringify({ data: { event_type: "reversal", user_id: "not-a-uuid" } }),
        JSON.stringify({ data: { event_type: "reversal", user_id: UID, reversed_transactions: [] } }),
        JSON.stringify({
          data: { event_type: "reversal", user_id: UID, reversed_transactions: [{ transaction_id: "bad id" }] },
        }),
      ];
      for (const body of cases) {
        expect((await POST(request(signedUrl(body), body))).status).toBe(400);
      }
      expect(mocks.processReversalAtomically).not.toHaveBeenCalled();
    } finally {
      restoreEnv(prev);
    }
  });

  it("413 on an oversized body", async () => {
    const prev = saveEnv();
    enable();
    try {
      const body = JSON.stringify({ data: { event_type: "ban", user_id: UID, reason: "x".repeat(70_000) } });
      expect((await POST(request(signedUrl(body), body))).status).toBe(413);
      expect(mocks.processBanAtomically).not.toHaveBeenCalled();
    } finally {
      restoreEnv(prev);
    }
  });

  it("GET is rejected", async () => {
    const res = await GET();
    expect(res.status).toBe(405);
  });
});
