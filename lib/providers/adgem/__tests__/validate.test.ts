import { describe, expect, it } from "vitest";
import { validateAdgemBody } from "../shared";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

function body(overrides: Record<string, unknown> = {}, dataOverrides: Record<string, unknown> = {}) {
  return {
    request_id: "01786456-b959-404a-baa7-05ef8a2e0290",
    timestamp: 1748365518,
    data: {
      app_id: "12345",
      campaign_id: "6789",
      player_id: UID,
      amount: 500,
      payout: 1.5,
      payout_cents: 150,
      all_goals_completed: true,
      conversion_id: "c5eb2a9d-41a4-4088-80bb-ebc87bd1bb62",
      offer_name: "Coin Master",
      goal_name: "Reach Level 10",
      goal_id: 4521,
      offer_id: 9087,
      conversion_type: "reward",
      ...dataOverrides,
    },
    ...overrides,
  };
}

describe("validateAdgemBody", () => {
  it("accepts the documented v3 example shape", () => {
    const res = validateAdgemBody(body());
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.body.requestId).toBe("01786456-b959-404a-baa7-05ef8a2e0290");
    expect(res.body.conversionId).toBe("c5eb2a9d-41a4-4088-80bb-ebc87bd1bb62");
    expect(res.body.playerId).toBe(UID);
    expect(res.body.conversionType).toBe("reward");
    expect(res.body.amountRaw).toBe(500);
    expect(res.body.payoutCents).toBe(150);
    expect(res.body.goalId).toBe("4521");
    expect(res.body.offerId).toBe("9087");
  });

  it("rejects malformed envelopes", () => {
    expect(validateAdgemBody(null).ok).toBe(false);
    expect(validateAdgemBody("string").ok).toBe(false);
    expect(validateAdgemBody([]).ok).toBe(false);
    expect(validateAdgemBody({}).ok).toBe(false);
    expect(validateAdgemBody(body({ request_id: "" })).ok).toBe(false);
    expect(validateAdgemBody(body({ timestamp: "1748365518" })).ok).toBe(false);
    expect(validateAdgemBody(body({ data: null })).ok).toBe(false);
  });

  it("rejects missing/bad identifiers", () => {
    expect(validateAdgemBody(body({}, { conversion_id: "" })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { player_id: "not-a-uuid" })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { player_id: "user@example.com" })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { conversion_type: "" })).ok).toBe(false);
  });

  it("keeps conversion_type validation semantic (unknown types pass shape, fail in process)", () => {
    // Shape accepts any non-empty type; processAdgemPostback refuses unknown ones.
    const res = validateAdgemBody(body({}, { conversion_type: "chargeback" }));
    expect(res.ok).toBe(true);
  });

  it("rejects non-numeric amounts and bad payout_cents", () => {
    expect(validateAdgemBody(body({}, { amount: "500" })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { amount: -1 })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { amount: NaN })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { amount: 1.5 })).ok).toBe(false); // Rounded config: integers only
    expect(validateAdgemBody(body({}, { amount: 1_000_001 })).ok).toBe(false); // over cap
    expect(validateAdgemBody(body({}, { payout_cents: 1.5 })).ok).toBe(false);
    expect(validateAdgemBody(body({}, { payout_cents: -10 })).ok).toBe(false);
  });

  it("accepts boundary amounts (0 for install, cap maximum)", () => {
    expect(validateAdgemBody(body({}, { amount: 0 })).ok).toBe(true);
    expect(validateAdgemBody(body({}, { amount: 1_000_000 })).ok).toBe(true);
  });

  it("tolerates absent optional fields", () => {
    const { goal_id, goal_name, offer_name, payout_cents, ...rest } = body().data as Record<string, unknown>;
    void goal_id;
    void goal_name;
    void offer_name;
    void payout_cents;
    const res = validateAdgemBody({ request_id: "r-9", timestamp: 1, data: { ...rest, conversion_id: "c-9", player_id: UID, amount: 10, conversion_type: "reward" } });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.body.goalId).toBeNull();
      expect(res.body.payoutCents).toBe(0);
    }
  });
});
