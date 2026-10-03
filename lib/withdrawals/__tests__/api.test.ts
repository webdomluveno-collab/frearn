import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth/server", () => ({
  getSessionUser: vi.fn(),
  isAdminEmail: vi.fn(),
  isSupabaseConfigured: vi.fn(() => true),
}));

vi.mock("@/lib/db/withdrawals", () => ({
  requestWithdrawal: vi.fn(),
  settleWithdrawal: vi.fn(),
}));

import { getSessionUser, isAdminEmail } from "@/lib/auth/server";
import { requestWithdrawal, settleWithdrawal } from "@/lib/db/withdrawals";
import type { WithdrawalRequestRow } from "@/lib/db/withdrawals";
import { POST as requestPost } from "@/app/api/withdrawals/request/route";
import { POST as approvePost } from "@/app/api/admin/withdrawals/[id]/approve/route";
import { POST as rejectPost } from "@/app/api/admin/withdrawals/[id]/reject/route";

const UID = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
const mockedSession = vi.mocked(getSessionUser);
const mockedAdmin = vi.mocked(isAdminEmail);
const mockedRequest = vi.mocked(requestWithdrawal);
const mockedSettle = vi.mocked(settleWithdrawal);

function post(body: unknown): Request {
  return new Request("https://freearn.local/api/withdrawals/request", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

function row(overrides: Partial<WithdrawalRequestRow> = {}): WithdrawalRequestRow {
  return {
    id: "req-1",
    userId: UID,
    amountCents: 500,
    method: "paypal",
    destination: "user@example.com",
    status: "requested",
    createdAt: new Date().toISOString(),
    ledgerTransactionId: "ledger-1",
    idempotencyKey: "k-1",
    updatedAt: new Date().toISOString(),
    reviewedBy: null,
    failureReason: null,
    ...overrides,
  };
}

let uidCounter = 0;
beforeEach(() => {
  vi.clearAllMocks();
  process.env.SUPABASE_SERVICE_ROLE_KEY = "test-service-key";
});

describe("POST /api/withdrawals/request", () => {
  it("1. unauthenticated withdrawal rejected (401)", async () => {
    mockedSession.mockResolvedValue(null);
    const res = await requestPost(post({ amountCents: 500, method: "paypal", destination: "a@b.co" }));
    expect(res.status).toBe(401);
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("2. $2.99 rejected (below_minimum)", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    const res = await requestPost(post({ amountCents: 299, method: "paypal", destination: "a@b.co" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("below_minimum");
  });

  it("3. exactly $3.00 accepted when store confirms", async () => {
    const sessionId = `test-user-${++uidCounter}`;
    mockedSession.mockResolvedValue({ id: sessionId, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: true, request: row({ amountCents: 300 }), duplicate: false });
    const res = await requestPost(
      post({
        amountCents: 300,
        method: "sol",
        destination: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ",
        requestKey: UID,
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { request: { amountCents: number }; duplicate: boolean };
    expect(body.request.amountCents).toBe(300);
    expect(body.duplicate).toBe(false);
    // Identity comes from the session, never the body.
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: sessionId, amountCents: 300 })
    );
  });

  it("4. request greater than balance rejected (insufficient_balance)", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: false, error: "insufficient_balance" });
    const res = await requestPost(post({ amountCents: 10000, method: "paypal", destination: "a@b.co" }));
    expect(res.status).toBe(422);
  });

  it("5/6/7. zero, negative, and non-integer cents rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    for (const amountCents of [0, -100, 300.5]) {
      const res = await requestPost(post({ amountCents, method: "paypal", destination: "a@b.co" }));
      expect(res.status).toBe(400);
    }
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("8/27. invalid method — including card — rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    for (const method of ["card", "usdt", "", "PAYPAL"]) {
      const res = await requestPost(post({ amountCents: 500, method, destination: "a@b.co" }));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe("invalid_method");
    }
  });

  it("9. invalid destination rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    const res = await requestPost(post({ amountCents: 500, method: "revolut", destination: "not-a-handle" }));
    expect(res.status).toBe(400);
  });

  it("10/11. PayPal and Skrill emails accepted", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    for (const method of ["paypal", "skrill"]) {
      mockedRequest.mockResolvedValue({ ok: true, request: row({ method }), duplicate: false });
      const res = await requestPost(post({ amountCents: 500, method, destination: "Pay@Example.COM" }));
      expect(res.status).toBe(200);
    }
  });

  it("12/13. valid Revolut accepted, invalid rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: true, request: row({ method: "revolut" }), duplicate: false });
    const good = await requestPost(post({ amountCents: 500, method: "revolut", destination: "@finance23" }));
    expect(good.status).toBe(200);
    const bad = await requestPost(post({ amountCents: 500, method: "revolut", destination: "finance23" }));
    expect(bad.status).toBe(400);
  });

  it("14/15. valid SOL and USDC destinations accepted", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    const addr = "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuQ";
    for (const method of ["sol", "usdc_solana"]) {
      mockedRequest.mockResolvedValue({ ok: true, request: row({ method }), duplicate: false });
      const res = await requestPost(post({ amountCents: 500, method, destination: addr }));
      expect(res.status).toBe(200);
    }
  });

  it("19. duplicate submission returns existing without double-deduct", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: true, request: row(), duplicate: true });
    const res = await requestPost(
      post({ amountCents: 500, method: "paypal", destination: "a@b.co", requestKey: UID })
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { duplicate: boolean }).duplicate).toBe(true);
  });

  it("28. service-role/admin fields never leak to the browser", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: true, request: row(), duplicate: false });
    const res = await requestPost(post({ amountCents: 500, method: "paypal", destination: "Full@Example.COM" }));
    const text = await res.text();
    expect(text).not.toContain("Full@Example.COM");
    expect(text).not.toContain("user@example.com");
    expect(text).not.toContain("destination");
    expect(text).not.toContain("service");
    const body = JSON.parse(text) as Record<string, unknown>;
    expect(Object.keys(body).sort()).toEqual(["duplicate", "request"]);
    expect(Object.keys(body.request as object).sort()).toEqual([
      "amountCents",
      "createdAt",
      "id",
      "method",
      "status",
    ]);
  });
});

describe("admin withdrawal actions", () => {
  const ctx = { params: { id: "req-1" } };

  it("24/25. normal user cannot approve or reject (404, deny-by-default)", async () => {
    mockedSession.mockResolvedValue({ id: UID, email: "user@x.co" });
    mockedAdmin.mockReturnValue(false);
    expect((await approvePost(new Request("https://x/", { method: "POST" }), ctx)).status).toBe(404);
    expect((await rejectPost(new Request("https://x/", { method: "POST" }), ctx)).status).toBe(404);
    expect(mockedSettle).not.toHaveBeenCalled();
  });

  it("unauthenticated admin calls get 404", async () => {
    mockedSession.mockResolvedValue(null);
    mockedAdmin.mockReturnValue(false);
    expect((await approvePost(new Request("https://x/", { method: "POST" }), ctx)).status).toBe(404);
  });

  it("20/21. admin confirm works once; repeat is a safe no-op", async () => {
    mockedSession.mockResolvedValue({ id: "admin", email: "ops@freearn.online" });
    mockedAdmin.mockReturnValue(true);
    mockedSettle.mockResolvedValue({ ok: true, requestId: "req-1", newStatus: "paid", already: false });
    const first = await approvePost(new Request("https://x/", { method: "POST" }), ctx);
    expect(first.status).toBe(200);
    mockedSettle.mockResolvedValue({ ok: true, requestId: "req-1", newStatus: "paid", already: true });
    const second = await approvePost(new Request("https://x/", { method: "POST" }), ctx);
    expect(second.status).toBe(200);
    expect(((await second.json()) as { already: boolean }).already).toBe(true);
  });

  it("22/23. admin reject restores once; repeat does not double-refund", async () => {
    mockedSession.mockResolvedValue({ id: "admin", email: "ops@freearn.online" });
    mockedAdmin.mockReturnValue(true);
    mockedSettle.mockResolvedValue({ ok: true, requestId: "req-1", newStatus: "rejected", already: false });
    expect((await rejectPost(new Request("https://x/", { method: "POST" }), ctx)).status).toBe(200);
    mockedSettle.mockResolvedValue({ ok: true, requestId: "req-1", newStatus: "rejected", already: true });
    const again = await rejectPost(new Request("https://x/", { method: "POST" }), ctx);
    expect(((await again.json()) as { already: boolean }).already).toBe(true);
  });
});
