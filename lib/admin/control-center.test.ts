import { beforeEach, describe, expect, it, vi } from "vitest";
const auth = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), configured: vi.fn(), db: vi.fn(), noStore: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: auth.noStore }));
vi.mock("@/lib/auth/server", () => ({ getSessionUser: auth.user, isAdminEmail: auth.admin, isSupabaseConfigured: auth.configured, getSupabaseAdmin: auth.db }));
import { calculateFinance, financePeriod, financeEventSchema, financeLedgerSchema, getControlCenter, readFinanceRows, type FinanceLedger, type FinanceWithdrawal } from "./control-center";
const AS_OF = "2026-10-25T12:00:00.000Z";
const NOW = "2026-10-25T11:00:00.000Z";
const OLD = "2026-09-01T00:00:00.000Z";
const row = (overrides: Partial<FinanceLedger> = {}): FinanceLedger => ({ id: "reward", user_id: "u1", type: "survey_reward", status: "confirmed", amount_cents: 70, publisher_revenue_cents: 100, provider: "cpx", provider_transaction_id: "tx1", created_at: NOW, ...overrides });
const wd = (overrides: Partial<FinanceWithdrawal> = {}): FinanceWithdrawal => ({ id: "w1", amount_cents: 50, status: "requested", created_at: NOW, updated_at: NOW, ...overrides });
const calc = (rows: FinanceLedger[] = [], withdrawals: FinanceWithdrawal[] = [], period: "7" | "30" | "all" = "all") => calculateFinance(rows, withdrawals, [], period, AS_OF);
beforeEach(() => { vi.resetAllMocks(); auth.user.mockResolvedValue({ id: "a", email: "admin@test.invalid" }); auth.admin.mockReturnValue(true); auth.configured.mockReturnValue(true); vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only"); });
describe("credit-backed financial definitions", () => {
    it("separates reported revenue, rewards, spread and paid withdrawals", () => {
        const r = calc([row()], [wd({ status: "paid", amount_cents: 10 })]);
        expect(r.reportedRevenueCents).toBe(100);
        expect(r.surveyOfferRewardsCents).toBe(70);
        expect(r.creditSpreadCents).toBe(30);
        expect(r.paid).toEqual({ count: 1, cents: 10 });
        expect(r).not.toHaveProperty("netProfit");
        expect(r).not.toHaveProperty("receivedRevenue");
    });
    it("counts confirmed positive rewards and distinct rewarded users, never survey opens", () => {
        const r = calculateFinance([row(), row({ id: "r2", provider_transaction_id: "tx2" }), row({ id: "r3", user_id: "u2", status: "pending" }), row({ id: "r4", user_id: "u3", status: "reversed" }), row({ id: "r5", type: "adjustment", user_id: "u4" })], [], [{ id: "e", provider: "timewall", processing_status: "held", received_at: NOW }], "all", AS_OF);
        expect(r.surveyOfferRewardsCents).toBe(140);
        expect(r.activeUsers).toBe(1);
        expect(r.reportedRevenueCents).toBe(200);
        expect(r.events.held).toBe(1);
    });
    it("keeps per-provider reward and revenue currencies separate", () => {
        const r = calc([row(), row({ id: "ad", provider: "adgem", type: "offer_reward", amount_cents: 35, publisher_revenue_cents: 150 }), row({ id: "tw", provider: "timewall", type: "offer_reward", amount_cents: 7, publisher_revenue_cents: 10 })]);
        expect(r.providers.find(p => p.provider === "adgem")).toMatchObject({ revenueCents: 150, rewardsCents: 35 });
        expect(r.providers.find(p => p.provider === "timewall")).toMatchObject({ revenueCents: 10, rewardsCents: 7 });
    });
    it.each([{ provider: null }, { provider: "unknown" }, { provider_transaction_id: null }, { publisher_revenue_cents: -1 }])("does not invent revenue coverage for %j", (bad) => {
        const r = calc([row(bad)]);
        expect(r.reportedRevenueCents).toBeNull();
        expect(r.creditSpreadCents).toBeNull();
        expect(r.surveyOfferRewardsCents).toBe(70);
    });
    it("does not subtract later reversal amounts twice from gross credited rewards", () => {
        const r = calc([row(), row({ id: "rev", type: "reversal", amount_cents: -70, publisher_revenue_cents: 0 }), row({ id: "void", provider: "manual", type: "reversal", amount_cents: 0 })]);
        expect(r.surveyOfferRewardsCents).toBe(70);
        expect(r.reportedRevenueCents).toBe(100);
        expect(r.reversals).toEqual({ count: 1, cents: 70, releasedHolds: 1 });
        expect(r.liabilities.totalCents).toBe(0);
    });
    it("includes reservations exactly once and excludes voided holds", () => {
        const r = calc([row({ amount_cents: 200 }), row({ id: "hold", type: "withdrawal", status: "pending", amount_cents: -60 }), row({ id: "void", type: "withdrawal", status: "reversed", amount_cents: -50 }), row({ id: "marker", type: "reversal", amount_cents: 0, provider: "manual" }), row({ id: "pending", status: "pending", amount_cents: 20 })], [wd({ amount_cents: 60 })]);
        expect(r.liabilities).toEqual({ availableCents: 140, reservedCents: 60, totalCents: 200, unconfirmedCents: 20, deficitCents: 0 });
        expect(r.pending.cents).toBe(60);
    });
    it("confirmed withdrawals are already deducted and deficits never offset another user", () => {
        const r = calc([row({ amount_cents: 200 }), row({ id: "paid", type: "withdrawal", amount_cents: -50 }), row({ id: "negative", user_id: "u2", type: "reversal", amount_cents: -80 })]);
        expect(r.liabilities.totalCents).toBe(150);
        expect(r.liabilities.deficitCents).toBe(80);
    });
    it.each(["requested", "reviewing", "approved", "processing"] as const)("counts %s as active across all ages", status => {
        expect(calc([], [wd({ status, created_at: OLD, updated_at: OLD })], "7").pending).toEqual({ count: 1, cents: 50 });
    });
    it("filters paid by settlement update time, not request creation", () => {
        const r = calc([], [wd({ id: "old-paid-today", status: "paid", created_at: OLD }), wd({ id: "old-paid", status: "paid", updated_at: OLD }), wd({ status: "rejected" })], "7");
        expect(r.paid).toEqual({ count: 1, cents: 50 });
        expect(r.pending.count).toBe(0);
    });
    it("uses rolling inclusive UTC boundaries; balances are not period-filtered", () => {
        const r = calc([row({ created_at: "2026-10-18T12:00:00.000Z" }), row({ id: "excluded", created_at: "2026-10-18T11:59:59.999Z" }), row({ id: "future", created_at: "2026-10-26T00:00:00.000Z" })], [], "7");
        expect(r.surveyOfferRewardsCents).toBe(70); // Future rows are excluded from reporting and balances.
        expect(r.liabilities.totalCents).toBe(140);
        const old = calc([row({ created_at: OLD })], [], "7");
        expect(old.surveyOfferRewardsCents).toBe(0);
        expect(old.liabilities.totalCents).toBe(70);
        expect(calc([row({ created_at: "2026-10-01T00:00:00.000Z" })], [], "30").surveyOfferRewardsCents).toBe(70);
    });
    it("accepts referral ledger rows as platform rewards, not provider income or survey activity", () => {
        const referral = row({ id: "referral", user_id: "u2", type: "referral_reward", amount_cents: 25, publisher_revenue_cents: 0, provider: null, provider_transaction_id: null });
        expect(financeLedgerSchema.safeParse(referral).success).toBe(true);
        const r = calc([row(), referral]);
        expect(r.reportedRevenueCents).toBe(100);
        expect(r.surveyOfferRewardsCents).toBe(70);
        expect(r.referralRewardsCents).toBe(25);
        expect(r.totalRewardCostsCents).toBe(95);
        expect(r.creditSpreadCents).toBe(5);
        expect(r.activeUsers).toBe(1);
        expect(r.providers.reduce((n, p) => n + p.credits, 0)).toBe(1);
        expect(r.providers.map(p => p.provider)).not.toContain("unattributed");
        expect(r.liabilities).toMatchObject({ availableCents: 95, totalCents: 95 });
    });
    it("accepts referral_reward rows from the paginated ledger read", async () => {
        const referral = row({ type: "referral_reward", amount_cents: 25, publisher_revenue_cents: 0, provider: null, provider_transaction_id: null });
        const { db } = database([{ data: [referral], count: 1, error: null }]);
        const read = await readFinanceRows(db, "ledger_transactions", "id,type", "created_at", AS_OF, financeLedgerSchema);
        expect(read[0].type).toBe("referral_reward");
    });
    it("represents a complete empty database with real zeros", () => { const r = calc(); expect(Object.is(r.reversals.cents, -0)).toBe(false); expect(r.activeUsers).toBe(0); expect(r.surveyOfferRewardsCents).toBe(0); expect(r.referralRewardsCents).toBe(0); expect(r.totalRewardCostsCents).toBe(0); expect(r.liabilities.totalCents).toBe(0); });
    it("fails instead of rounding an unsafe total", () => { expect(() => calc([row({ amount_cents: Number.MAX_SAFE_INTEGER }), row({ id: "two", amount_cents: 1 })])).toThrow(); });
    it.each([undefined, "bad", ["7"], "0"])("normalizes invalid filter %j", value => expect(financePeriod(value)).toBe("all"));
    it("supports only the specified reporting periods", () => { expect(financePeriod("7")).toBe("7"); expect(financePeriod("30")).toBe("30"); });
});
function database(pages: {
    data: unknown[] | null;
    count: number | null;
    error: unknown;
}[]) {
    const query = { select: vi.fn(), lte: vi.fn(), order: vi.fn(), range: vi.fn() };
    query.select.mockReturnValue(query);
    query.lte.mockReturnValue(query);
    query.order.mockReturnValue(query);
    for (const page of pages)
        query.range.mockResolvedValueOnce(page);
    const db = { from: vi.fn(() => query) };
    return { db: db as unknown as Parameters<typeof readFinanceRows>[0], query };
}
const event = (id: number) => ({ id: String(id), provider: "cpx", processing_status: "processed", received_at: NOW });
describe("complete SELECT-only reads and admin boundary", () => {
    it("paginates beyond the default 1000 rows", async () => {
        const { db, query } = database([0, 1, 2].map(page => ({ count: 1001, error: null, data: Array.from({ length: page === 2 ? 1 : 500 }, (_, i) => event(page * 500 + i)) })));
        expect(await readFinanceRows(db, "provider_events", "id,provider,processing_status,received_at", "received_at", AS_OF, financeEventSchema)).toHaveLength(1001);
        expect(query.range.mock.calls).toEqual([[0, 499], [500, 999], [1000, 1499]]);
        expect(query.lte).toHaveBeenCalledWith("received_at", AS_OF);
    });
    it.each([
        { data: [event(1)], count: 600, error: null },
        { data: [], count: 50001, error: null },
        { data: [], count: null, error: null },
        { data: null, count: 0, error: { message: "private-details" } },
        { data: [event(1), event(1)], count: 2, error: null },
        { data: [{ ...event(1), received_at: "invalid" }], count: 1, error: null },
    ])("rejects incomplete, capped, invalid or duplicate-page reads", async (page) => {
        const { db } = database([page]);
        await expect(readFinanceRows(db, "provider_events", "id", "received_at", AS_OF, financeEventSchema)).rejects.toThrow();
    });
    it("rejects a changing row count between pages", async () => {
        const { db } = database([{ data: Array.from({ length: 500 }, (_, i) => event(i)), count: 501, error: null }, { data: [event(500)], count: 502, error: null }]);
        await expect(readFinanceRows(db, "provider_events", "id", "received_at", AS_OF, financeEventSchema)).rejects.toThrow();
    });
    it.each([null, { id: "user", email: "user@test.invalid" }])("denies anonymous and non-admin before service client creation", async (user) => {
        auth.user.mockResolvedValue(user);
        auth.admin.mockReturnValue(false);
        await expect(getControlCenter("all")).rejects.toThrow("Forbidden");
        expect(auth.db).not.toHaveBeenCalled();
    });
    it("unconfigured is unavailable, never zero", async () => { auth.configured.mockReturnValue(false); expect(await getControlCenter("7")).toEqual({ status: "unavailable" }); expect(auth.db).not.toHaveBeenCalled(); });
    it("suppresses database errors without leaking details or displaying partial totals", async () => {
        auth.db.mockImplementation(() => { throw new Error("SECRET simulated error"); });
        const result = await getControlCenter("all");
        expect(result).toEqual({ status: "unavailable" });
        expect(JSON.stringify(result)).not.toContain("SECRET");
    });
    it("admin reads only minimal columns and disables caching", async () => {
        const { db, query } = database(Array.from({ length: 3 }, () => ({ data: [], count: 0, error: null })));
        auth.db.mockReturnValue(db);
        expect((await getControlCenter("all")).status).toBe("ready");
        expect(auth.noStore).toHaveBeenCalled();
        const selected = query.select.mock.calls.map(args => args[0]).join(",");
        expect(selected).not.toMatch(/email|destination|raw_payload|reviewed_by|metadata/);
    });
    it("rejects malformed money instead of coercing it to zero", () => { expect(financeLedgerSchema.safeParse(row({ amount_cents: 1.1 })).success).toBe(false); expect(financeLedgerSchema.safeParse({ ...row(), publisher_revenue_cents: null }).success).toBe(false); });
});
