import { beforeEach, describe, expect, it, vi } from "vitest";
import { GET, POST } from "@/app/api/providers/theoremreach/postback/route";
import { theoremreachCallbackEndpoint, theoremreachCallbackHash } from "../server";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const KEY = "test-theoremreach-secret-postback";

const mocks = vi.hoisted(() => ({
  processRewardAtomically: vi.fn(),
}));

vi.mock("@/lib/db/theoremreach-store", () => ({
  SupabaseTheoremreachStore: class {
    processRewardAtomically = mocks.processRewardAtomically;
  },
}));

function saveEnv() {
  return {
    secret: process.env.THEOREMREACH_SECRET_KEY,
    enabled: process.env.THEOREMREACH_POSTBACK_ENABLED,
    rewardProcessing: process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED,
    wallEnabled: process.env.THEOREMREACH_WALL_ENABLED,
    pilotEnabled: process.env.THEOREMREACH_PILOT_ENABLED,
    pilotUserIds: process.env.THEOREMREACH_PILOT_USER_IDS,
  };
}

function restoreEnv(prev: ReturnType<typeof saveEnv>) {
  for (const [key, value] of [
    ["THEOREMREACH_SECRET_KEY", prev.secret],
    ["THEOREMREACH_POSTBACK_ENABLED", prev.enabled],
    ["THEOREMREACH_REWARD_PROCESSING_ENABLED", prev.rewardProcessing],
    ["THEOREMREACH_WALL_ENABLED", prev.wallEnabled],
    ["THEOREMREACH_PILOT_ENABLED", prev.pilotEnabled],
    ["THEOREMREACH_PILOT_USER_IDS", prev.pilotUserIds],
  ] as const) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function enable() {
  process.env.THEOREMREACH_SECRET_KEY = KEY;
  process.env.THEOREMREACH_POSTBACK_ENABLED = "true";
  process.env.THEOREMREACH_WALL_ENABLED = "true";
}

function get(url: string): Request {
  return new Request(url, { method: "GET" });
}

function cb(params: Record<string, string>): string {
  return `https://freearn.local/api/providers/theoremreach/postback?${new URLSearchParams(params).toString()}`;
}

function live(extra: Record<string, string> = {}): string {
  return cb({
    reward: "70",
    currency: "1.00",
    user_id: UID,
    tx_id: "tr-live-1",
    hash: "unproven-hash",
    ...extra,
  });
}

function signed(params: Record<string, string>): string {
  const unsignedUrl = `${theoremreachCallbackEndpoint()}?${new URLSearchParams(params).toString()}`;
  return `${unsignedUrl}&hash=${theoremreachCallbackHash(unsignedUrl)}`;
}

function signedLive(extra: Record<string, string> = {}): string {
  return signed({
    reward: "70",
    currency: "1.00",
    user_id: UID,
    tx_id: "provider-reward-1",
    transaction_id: "entry-session-1",
    ...extra,
  });
}

describe("GET /api/providers/theoremreach/postback — default OFF", () => {
  const prev = saveEnv();
  const restore = () => restoreEnv(prev);

  beforeEach(() => {
    mocks.processRewardAtomically.mockReset();
  });

  it("503 when postbacks are not enabled (fail closed)", async () => {
    delete process.env.THEOREMREACH_SECRET_KEY;
    delete process.env.THEOREMREACH_POSTBACK_ENABLED;
    try {
      const res = await GET(get(live()));
      expect(res.status).toBe(503);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("debug=true returns 200 even with otherwise garbage params (completely ignored)", async () => {
    enable();
    try {
      const res = await GET(get(cb({ debug: "true", nonsense: "<script>" })));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1");
    } finally {
      restore();
    }
  });

  it("debug=true wins over reversal=true (never reverses, never writes)", async () => {
    enable();
    try {
      const res = await GET(
        get(live({ debug: "true", reversal: "true", reward: "70", currency: "1.00" }))
      );
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1");
    } finally {
      restore();
    }
  });

  it("valid-shape non-debug callback with an invalid hash fails closed", async () => {
    enable();
    try {
      const res = await GET(get(live()));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("pilot mode rejects a validly signed callback for a non-allowlisted UUID", async () => {
    enable();
    process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED = "true";
    delete process.env.THEOREMREACH_WALL_ENABLED;
    process.env.THEOREMREACH_PILOT_ENABLED = "true";
    process.env.THEOREMREACH_PILOT_USER_IDS = UID;
    try {
      const url = signed({
        reward: "70",
        currency: "1.00",
        user_id: "bbbbbbbb-cccc-dddd-eeee-ffffffffffff",
        tx_id: "pilot-denied-reward",
      });
      const res = await GET(get(url));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
      expect(mocks.processRewardAtomically).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("pilot mode processes a valid signed callback for the allowlisted UUID", async () => {
    enable();
    process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED = "true";
    delete process.env.THEOREMREACH_WALL_ENABLED;
    process.env.THEOREMREACH_PILOT_ENABLED = "true";
    process.env.THEOREMREACH_PILOT_USER_IDS = UID;
    mocks.processRewardAtomically.mockResolvedValue({ outcome: "rewarded", ledgerId: "pilot-ledger-1" });
    try {
      const res = await GET(get(signedLive({ tx_id: "pilot-allowed-reward" })));
      expect(res.status).toBe(200);
      expect(mocks.processRewardAtomically).toHaveBeenCalledTimes(1);
      expect(mocks.processRewardAtomically.mock.calls[0][0].userId).toBe(UID);
    } finally {
      restore();
    }
  });

  it("disabling pilot does not open callbacks while the public wall is off", async () => {
    enable();
    process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED = "true";
    delete process.env.THEOREMREACH_WALL_ENABLED;
    delete process.env.THEOREMREACH_PILOT_ENABLED;
    delete process.env.THEOREMREACH_PILOT_USER_IDS;
    try {
      const res = await GET(get(signedLive({ tx_id: "pilot-disabled-wall-off" })));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
      expect(mocks.processRewardAtomically).not.toHaveBeenCalled();
    } finally {
      restore();
    }
  });

  it("accepts provider tx_id plus a different optional transaction_id and keeps processing disabled", async () => {
    enable();
    try {
      const res = await GET(get(signedLive({ tx_id: "provider-reward-1", transaction_id: "entry-session-1" })));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("requires provider tx_id even when transaction_id is present", async () => {
    enable();
    try {
      const url = signed({
        reward: "70",
        currency: "1.00",
        user_id: UID,
        transaction_id: "entry-session-only",
      });
      const res = await GET(get(url));
      expect(res.status).toBe(400);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("rejects a malformed optional transaction_id without confusing it for tx_id", async () => {
    enable();
    try {
      const url = signed({
        reward: "70",
        currency: "1.00",
        user_id: UID,
        tx_id: "provider-reward-1",
        transaction_id: "bad id",
      });
      const res = await GET(get(url));
      expect(res.status).toBe(400);
    } finally {
      restore();
    }
  });

  it("uses tx_id for reward identity and passes transaction_id only as entry-session audit", async () => {
    enable();
    process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED = "true";
    mocks.processRewardAtomically.mockResolvedValue({ outcome: "rewarded", ledgerId: "ledger-1" });
    try {
      const url = signedLive({ tx_id: "provider-reward-1", transaction_id: "entry-session-1" });
      const res = await GET(get(url));
      expect(res.status).toBe(200);
      expect(await res.text()).toBe("1");
      expect(mocks.processRewardAtomically).toHaveBeenCalledWith({
        txId: "provider-reward-1",
        entryTransactionId: "entry-session-1",
        userId: UID,
        reversal: false,
        userRewardCents: 70,
        publisherRevenueCents: 100,
      });
    } finally {
      restore();
    }
  });

  it("deduplicates by tx_id even when transaction_id differs", async () => {
    enable();
    process.env.THEOREMREACH_REWARD_PROCESSING_ENABLED = "true";
    mocks.processRewardAtomically.mockResolvedValue({ outcome: "duplicate", ledgerId: "ledger-1" });
    try {
      const first = signedLive({ tx_id: "provider-reward-1", transaction_id: "entry-session-1" });
      const second = signedLive({ tx_id: "provider-reward-1", transaction_id: "entry-session-2" });
      expect((await GET(get(first))).status).toBe(200);
      expect((await GET(get(second))).status).toBe(200);
      expect(mocks.processRewardAtomically).toHaveBeenCalledTimes(2);
      expect(mocks.processRewardAtomically.mock.calls[0][0].txId).toBe("provider-reward-1");
      expect(mocks.processRewardAtomically.mock.calls[1][0].txId).toBe("provider-reward-1");
      expect(mocks.processRewardAtomically.mock.calls[0][0].entryTransactionId).toBe("entry-session-1");
      expect(mocks.processRewardAtomically.mock.calls[1][0].entryTransactionId).toBe("entry-session-2");
    } finally {
      restore();
    }
  });

  it("rejects a modified signed amount and duplicate query parameters", async () => {
    enable();
    try {
      const signed = signedLive();
      expect((await GET(get(signed.replace("reward=70", "reward=71")))).status).toBe(403);

      const duplicate = `${theoremreachCallbackEndpoint()}?reward=70&%72eward=71&currency=1.00&user_id=${UID}&tx_id=reward-2&hash=invalid`;
      expect((await GET(get(duplicate))).status).toBe(400);
    } finally {
      restore();
    }
  });

  it("non-debug reversal=true cannot debit (fails closed)", async () => {
    enable();
    try {
      const res = await GET(get(live({ tx_id: "tr-rev-1", reversal: "true" })));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("400 on missing/invalid required fields", async () => {
    enable();
    try {
      const cases: Record<string, string>[] = [
        { currency: "1.00", user_id: UID, tx_id: "t", hash: "h" }, // no reward
        { reward: "70", user_id: UID, tx_id: "t", hash: "h" }, // no currency
        { reward: "70", currency: "1.00", tx_id: "t", hash: "h" }, // no user
        { reward: "70", currency: "1.00", user_id: "not-a-uuid", tx_id: "t", hash: "h" },
        { reward: "70", currency: "1.00", user_id: UID, hash: "h" }, // no provider tx_id
        { reward: "70", currency: "1.00", user_id: UID, tx_id: "t" }, // no hash
      ];
      for (const params of cases) {
        const res = await GET(get(cb(params)));
        expect(res.status).toBe(400);
        expect(await res.text()).toBe("0");
      }
    } finally {
      restore();
    }
  });

  it("400 on non-creditable value shapes (never reaches money)", async () => {
    enable();
    try {
      for (const params of [
        { reward: "70.5", currency: "1.00" },
        { reward: "-5", currency: "1.00" },
        { reward: "abc", currency: "1.00" },
        { reward: "70", currency: "xyz" },
      ]) {
        // Use signedLive so the hash matches; otherwise hash check fails first
        const signed = signedLive({ reward: params.reward, currency: params.currency });
        const res = await GET(get(signed));
        expect(res.status).toBe(400);
      }
    } finally {
      restore();
    }
  });

  it("deprecated status field never controls the outcome", async () => {
    enable();
    try {
      const res = await GET(get(live({ tx_id: "tr-status-1", status: "complete" })));
      expect(res.status).toBe(403);
      expect(await res.text()).toBe("0");
    } finally {
      restore();
    }
  });

  it("POST is rejected", async () => {
    const res = await POST();
    expect(res.status).toBe(405);
  });
});
