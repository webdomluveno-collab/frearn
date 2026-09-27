import { describe, expect, it } from "vitest";
import {
  normalizePostback,
  validatePostbackShape,
  type CpxPostbackParams,
} from "../shared";

/**
 * Regression test for the Sep 2026 production incident: the official CPX
 * Testing Tool request was rejected with HTTP 400 because amount_local
 * arrives with 4 decimal places ("0.3500").
 *
 * Exact production query (hash redacted to a shape-valid placeholder;
 * authenticity is covered by hash.test.ts + route.test.ts):
 *   ?status=1&trans_id=1001219062357
 *   &user_id=b02fda61-37ef-4d61-900b-5b2a747e29ec
 *   &sub_id=&sub_id_2=
 *   &amount_local=0.3500&amount_usd=0.50&offer_id=1
 *   &hash=<32-char md5>&ip_click=109.81.115.88
 */
const PRODUCTION_QUERY =
  "status=1&trans_id=1001219062357" +
  "&user_id=b02fda61-37ef-4d61-900b-5b2a747e29ec" +
  "&sub_id=&sub_id_2=" +
  "&amount_local=0.3500&amount_usd=0.50&offer_id=1" +
  "&hash=b6dafddff5d69f8d2a58d01bbdd17ae8" +
  "&ip_click=109.81.115.88";

/** Mirrors the route's query → params mapping exactly. */
function paramsFromQuery(query: string): CpxPostbackParams {
  const q = Object.fromEntries(new URLSearchParams(query).entries());
  return {
    status: q.status,
    transId: q.trans_id,
    extUserId: q.user_id,
    amountLocal: q.amount_local,
    amountUsd: q.amount_usd,
    offerId: q.offer_id,
    hash: q.hash,
    subId: q.sub_id,
    subId2: q.sub_id_2,
    ipClick: q.ip_click,
  };
}

describe("official CPX Testing Tool request shape", () => {
  it("passes shape validation (empty sub_ids, 4-decimal amounts, real field set)", () => {
    const p = paramsFromQuery(PRODUCTION_QUERY);
    expect(p.subId).toBe("");
    expect(p.subId2).toBe("");
    const shape = validatePostbackShape(p);
    expect(shape).toEqual({ ok: true });
  });

  it("normalizes to exact integer cents (0.3500 → 35, 0.50 → 50)", () => {
    const n = normalizePostback(paramsFromQuery(PRODUCTION_QUERY));
    expect(n.status).toBe("1");
    expect(n.transId).toBe("1001219062357");
    expect(n.extUserId).toBe("b02fda61-37ef-4d61-900b-5b2a747e29ec");
    expect(n.userRewardCents).toBe(35);
    expect(n.publisherRevenueCents).toBe(50);
    expect(Number.isInteger(n.userRewardCents)).toBe(true);
    expect(Number.isInteger(n.publisherRevenueCents)).toBe(true);
    expect(n.offerId).toBe("1");
    expect(n.subId).toBeNull();
    expect(n.subId2).toBeNull();
  });
});
