import { beforeEach, describe, expect, it, vi } from "vitest";
import { METHOD_CASES } from "./cases";

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
    method: "revolut",
    destination: "@someone",
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
    const res = await requestPost(post({ amountCents: 500, method: "revolut", destination: "@someone" }));
    expect(res.status).toBe(401);
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("2. $0.09 rejected (below_minimum)", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    const res = await requestPost(post({ amountCents: 9, method: "revolut", destination: "@someone" }));
    expect(res.status).toBe(400);
    expect(((await res.json()) as { error: string }).error).toBe("below_minimum");
  });

  it("3. exactly $0.10 accepted when store confirms", async () => {
    const sessionId = `test-user-${++uidCounter}`;
    mockedSession.mockResolvedValue({ id: sessionId, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: true, request: row({ amountCents: 10 }), duplicate: false });
    const res = await requestPost(
      post({
        amountCents: 10,
        method: "revolut",
        destination: "@someone",
        requestKey: UID,
      })
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as { request: { amountCents: number }; duplicate: boolean };
    expect(body.request.amountCents).toBe(10);
    expect(body.duplicate).toBe(false);
    // Identity comes from the session, never the body.
    expect(mockedRequest).toHaveBeenCalledWith(
      expect.objectContaining({ userId: sessionId, amountCents: 10 })
    );
  });

  it("4. request greater than balance rejected (insufficient_balance)", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: false, error: "insufficient_balance" });
    const res = await requestPost(post({ amountCents: 10000, method: "revolut", destination: "@someone" }));
    expect(res.status).toBe(422);
  });

  it("5/6/7. zero, negative, and non-integer cents rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    for (const amountCents of [0, -100, 300.5]) {
      const res = await requestPost(post({ amountCents, method: "revolut", destination: "@someone" }));
      expect(res.status).toBe(400);
    }
    expect(mockedRequest).not.toHaveBeenCalled();
  });

  it("8/27. invalid method — including card — rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    for (const method of ["card", "usdt", "", "PAYPAL"]) {
      const res = await requestPost(post({ amountCents: 500, method, destination: "@someone" }));
      expect(res.status).toBe(400);
      expect(((await res.json()) as { error: string }).error).toBe("invalid_method");
    }
  });

  it("9. invalid destination rejected", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    const res = await requestPost(post({ amountCents: 500, method: "revolut", destination: "not-a-handle" }));
    expect(res.status).toBe(400);
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
      post({ amountCents: 500, method: "revolut", destination: "@someone", requestKey: UID })
    );
    expect(res.status).toBe(200);
    expect(((await res.json()) as { duplicate: boolean }).duplicate).toBe(true);
  });

  it("28. service-role/admin fields never leak to the browser", async () => {
    mockedSession.mockResolvedValue({ id: `test-user-${++uidCounter}`, email: "u@x.co" });
    mockedRequest.mockResolvedValue({ ok: true, request: row(), duplicate: false });
    const res = await requestPost(post({ amountCents: 500, method: "revolut", destination: "@FullUsername" }));
    const text = await res.text();
    expect(text).not.toContain("@FullUsername");
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

describe("withdrawal integration guard", () => {
  it("returns a conflict when RPC rejects a second active withdrawal", async () => {
    mockedSession.mockResolvedValue({id:`test-user-${++uidCounter}`,email:"u@x.co"});
    mockedRequest.mockResolvedValue({ok:false,error:"pending_withdrawal"});
    const res=await requestPost(post({amountCents:10,method:"revolut",destination:"@someone"}));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({error:"pending_withdrawal"});
  });
  it("ignores spoofed user_id and userId in the financial request body", async () => {
    const id=`test-user-${++uidCounter}`;
    mockedSession.mockResolvedValue({id,email:"u@x.co"});
    mockedRequest.mockResolvedValue({ok:true,request:row({amountCents:10}),duplicate:false});
    await requestPost(post({amountCents:10,method:"revolut",destination:"@someone",user_id:"victim",userId:"victim"}));
    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({userId:id}));
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

describe("API method-specific boundaries", () => {
  it.each(METHOD_CASES)("$method below $minimum cents never reaches RPC", async ({method,minimum,destination}) => {
    mockedSession.mockResolvedValue({id:`test-user-${++uidCounter}`,email:"u@x.co"});
    const res=await requestPost(post({method,amountCents:minimum-1,destination}));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({error:"below_minimum",method,minimumCents:minimum});
    expect(mockedRequest).not.toHaveBeenCalled();
  });
  it.each(METHOD_CASES)("$method exactly $minimum cents reaches atomic RPC", async ({method,minimum,destination}) => {
    const id=`test-user-${++uidCounter}`;mockedSession.mockResolvedValue({id,email:"u@x.co"});
    mockedRequest.mockResolvedValue({ok:true,request:row({method,amountCents:minimum}),duplicate:false});
    const res=await requestPost(post({method,amountCents:minimum,destination,requestKey:UID,userId:"spoofed"}));
    expect(res.status).toBe(200);
    expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({userId:id,method,amountCents:minimum,destination}));
  });
  it.each(["paypal","unknown","card"])("%s cannot create a new request", async method => {
    mockedSession.mockResolvedValue({id:`test-user-${++uidCounter}`,email:"u@x.co"});
    const res=await requestPost(post({method,amountCents:100,destination:"old@example.com"}));
    expect(res.status).toBe(400);expect(await res.json()).toEqual({error:"invalid_method"});
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});

describe("PayPal disabled at every amount",()=>{
  it.each([9,10,99,100,10000])("rejects new PayPal at %s cents before any RPC",async amountCents=>{
    mockedSession.mockResolvedValue({id:`test-user-${++uidCounter}`,email:"u@x.co"});
    const res=await requestPost(post({method:"paypal",amountCents,destination:"legacy@example.com"}));
    expect(res.status).toBe(400);expect(await res.json()).toEqual({error:"invalid_method"});
    expect(mockedRequest).not.toHaveBeenCalled();
  });
});

it("Skrill email is normalized before the authoritative request; amount stays gross",async()=>{
  const id=`test-user-${++uidCounter}`;mockedSession.mockResolvedValue({id,email:"u@x.co"});
  mockedRequest.mockResolvedValue({ok:true,request:row({method:"skrill",amountCents:100}),duplicate:false});
  const res=await requestPost(post({method:"skrill",amountCents:100,destination:" User@Example.COM ",requestKey:UID}));
  expect(res.status).toBe(200);expect(mockedRequest).toHaveBeenCalledWith(expect.objectContaining({method:"skrill",amountCents:100,destination:"user@example.com"}));
});
