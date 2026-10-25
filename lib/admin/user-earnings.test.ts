import { beforeEach, describe, expect, it, vi } from "vitest";

const auth = vi.hoisted(() => ({ user: vi.fn(), admin: vi.fn(), configured: vi.fn(), db: vi.fn(), noStore: vi.fn() }));
vi.mock("next/cache", () => ({ unstable_noStore: auth.noStore }));
vi.mock("@/lib/auth/server", () => ({
  getSessionUser: auth.user,
  isAdminEmail: auth.admin,
  isSupabaseConfigured: auth.configured,
  getSupabaseAdmin: auth.db,
}));

import { calculateUserEarnings, getUserEarningsPage } from "./user-earnings";
import type { FinanceLedger } from "./control-center";

const AS_OF = "2026-10-25T12:00:00.000Z";
const NOW = "2026-10-25T11:00:00.000Z";
const USER_ONE = "00000000-0000-4000-8000-000000000001";
const USER_TWO = "00000000-0000-4000-8000-000000000002";

const profile = (id: string) => ({ id, created_at: NOW });
const ledger = (overrides: Partial<FinanceLedger> & Pick<FinanceLedger, "id" | "user_id">): FinanceLedger => ({
  type: "survey_reward",
  status: "confirmed",
  amount_cents: 0,
  publisher_revenue_cents: 0,
  provider: null,
  provider_transaction_id: null,
  created_at: NOW,
  ...overrides,
});
const request = (overrides: { id: string; user_id: string; amount_cents: number; status: "requested" | "reviewing" | "approved" | "processing" | "paid" | "rejected" }) => ({
  ...overrides,
  created_at: NOW,
  updated_at: NOW,
});

beforeEach(() => {
  vi.resetAllMocks();
  auth.user.mockResolvedValue({ id: "admin", email: "admin@test.invalid" });
  auth.admin.mockReturnValue(true);
  auth.configured.mockReturnValue(true);
  vi.stubEnv("SUPABASE_SERVICE_ROLE_KEY", "test-only");
});

describe("per-user earnings use the existing ledger semantics", () => {
  it("includes survey, offer and referral credits; keeps reversals and paid withdrawals separate", () => {
    const rows = [
      ledger({ id: "survey", user_id: USER_ONE, type: "survey_reward", amount_cents: 100 }),
      ledger({ id: "offer", user_id: USER_ONE, type: "offer_reward", amount_cents: 50 }),
      ledger({ id: "referral", user_id: USER_ONE, type: "referral_reward", amount_cents: 30 }),
      ledger({ id: "reversal", user_id: USER_ONE, type: "reversal", amount_cents: -20 }),
      ledger({ id: "hold", user_id: USER_ONE, type: "withdrawal", status: "pending", amount_cents: -60 }),
      ledger({ id: "paid-ledger", user_id: USER_ONE, type: "withdrawal", amount_cents: -40 }),
      ledger({ id: "pending-referral", user_id: USER_ONE, type: "referral_reward", status: "pending", amount_cents: 15 }),
      ledger({ id: "reversed-referral", user_id: USER_ONE, type: "referral_reward", status: "reversed", amount_cents: 90 }),
      ledger({ id: "adjustment", user_id: USER_ONE, type: "adjustment", amount_cents: 500 }),
      ledger({ id: "future-referral", user_id: USER_ONE, type: "referral_reward", amount_cents: 999, created_at: "2026-10-26T00:00:00.000Z" }),
    ];
    const result = calculateUserEarnings(
      [profile(USER_ONE)],
      rows,
      [request({ id: "paid", user_id: USER_ONE, amount_cents: 40, status: "paid" }), request({ id: "rejected", user_id: USER_ONE, amount_cents: 80, status: "rejected" })],
      AS_OF
    )[0];

    expect(result).toMatchObject({
      confirmedEarningsCents: 180,
      reversalCents: 20,
      reversalCount: 1,
      withdrawalCount: 2,
      paidWithdrawalCents: 40,
      paidWithdrawalCount: 1,
      availableCents: 560,
      reservedCents: 60,
      unconfirmedCents: 15,
    });
  });

  it("keeps profiles with no ledger activity and handles missing balances as zero", () => {
    expect(calculateUserEarnings([profile(USER_TWO)], [], [], AS_OF)).toEqual([{
      userId: USER_TWO,
      confirmedEarningsCents: 0,
      reversalCents: 0,
      reversalCount: 0,
      withdrawalCount: 0,
      paidWithdrawalCents: 0,
      paidWithdrawalCount: 0,
      availableCents: 0,
      reservedCents: 0,
      unconfirmedCents: 0,
    }]);
  });
});

function paginatedDatabase(tables: Record<string, unknown[]>) {
  const selections: Array<{ table: string; columns: string }> = [];
  const ranges: Array<{ table: string; from: number; to: number }> = [];
  const db = {
    from: vi.fn((table: string) => {
      const query: {
        select: ReturnType<typeof vi.fn>;
        lte: ReturnType<typeof vi.fn>;
        order: ReturnType<typeof vi.fn>;
        range: ReturnType<typeof vi.fn>;
      } = {
        select: vi.fn((columns: string) => { selections.push({ table, columns }); return query; }),
        lte: vi.fn(() => query),
        order: vi.fn(() => query),
        range: vi.fn(async (from: number, to: number) => {
          ranges.push({ table, from, to });
          const rows = tables[table] ?? [];
          return { data: rows.slice(from, to + 1), count: rows.length, error: null };
        }),
      };
      return query;
    }),
  };
  return { db, selections, ranges };
}

describe("users and earnings page loader", () => {
  it("denies non-admins before constructing the service-role client", async () => {
    auth.user.mockResolvedValue(null);
    await expect(getUserEarningsPage({})).rejects.toThrow("Forbidden");
    expect(auth.db).not.toHaveBeenCalled();
  });

  it("reads complete paginated tables, sorts globally by earnings, and searches IDs without PII", async () => {
    const profiles = Array.from({ length: 501 }, (_, i) => profile(`00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`));
    const ledgerRows = [ledger({ id: "referral-credit", user_id: USER_ONE, type: "referral_reward", amount_cents: 250 })];
    const withdrawalRows = [request({ id: "paid-request", user_id: USER_ONE, amount_cents: 100, status: "paid" })];
    const store = paginatedDatabase({ profiles, ledger_transactions: ledgerRows, withdrawal_requests: withdrawalRows });
    auth.db.mockReturnValue(store.db);

    const firstPage = await getUserEarningsPage({ sort: "earnings_desc", page: "1" });
    expect(firstPage.status).toBe("ready");
    if (firstPage.status !== "ready") return;
    expect(firstPage.totalUsers).toBe(501);
    expect(firstPage.pageCount).toBe(11);
    expect(firstPage.users).toHaveLength(50);
    expect(firstPage.users[0]).toMatchObject({
      userId: USER_ONE,
      confirmedEarningsCents: 250,
      withdrawalCount: 1,
      paidWithdrawalCents: 100,
      paidWithdrawalCount: 1,
    });
    expect(store.ranges.filter(range => range.table === "profiles")).toEqual([
      { table: "profiles", from: 0, to: 499 },
      { table: "profiles", from: 500, to: 999 },
    ]);
    expect(store.selections.every(({ columns }) => !/email|destination|reviewed_by|failure_reason/i.test(columns))).toBe(true);

    const matching = await getUserEarningsPage({ query: USER_ONE, sort: "earnings_desc" });
    expect(matching).toMatchObject({ status: "ready", totalUsers: 1, pageCount: 1, query: USER_ONE });
    if (matching.status === "ready") expect(matching.users[0].userId).toBe(USER_ONE);
  });
});
