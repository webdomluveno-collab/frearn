import "server-only";
import { unstable_noStore as noStore } from "next/cache";
import { z } from "zod";
import { getSessionUser, getSupabaseAdmin, isAdminEmail, isSupabaseConfigured } from "@/lib/auth/server";
import { summarizeLedger } from "@/lib/wallet/ledger";
import type { LedgerTransaction } from "@/types";
import { financeLedgerSchema, readFinanceRows } from "./control-center";

const MAX_USER_ROWS = 50000;
const PAGE_SIZE = 50;
const cents = z.number().int().safe();
const timestamp = z.string().datetime({ offset: true });
const profileSchema = z.object({ id: z.string().uuid(), created_at: timestamp });
const userWithdrawalSchema = z.object({
  id: z.string(),
  user_id: z.string().uuid(),
  amount_cents: cents.positive(),
  status: z.enum(["requested", "reviewing", "approved", "processing", "paid", "rejected"]),
  created_at: timestamp,
  updated_at: timestamp,
});

export type UserEarningsSort = "earnings_desc" | "earnings_asc" | "user_id";
export type UserEarningsRow = {
  userId: string;
  confirmedEarningsCents: number;
  reversalCents: number;
  reversalCount: number;
  withdrawalCount: number;
  paidWithdrawalCents: number;
  paidWithdrawalCount: number;
  availableCents: number;
  reservedCents: number;
  unconfirmedCents: number;
};
export type UserEarningsPage = {
  status: "ready";
  users: UserEarningsRow[];
  totalUsers: number;
  page: number;
  pageCount: number;
  query: string;
  sort: UserEarningsSort;
  asOf: string;
} | {
  status: "unavailable";
};

const REWARD_TYPES = new Set(["survey_reward", "offer_reward", "referral_reward"]);

function addCents(left: number, right: number): number {
  const total = left + right;
  if (!Number.isSafeInteger(total)) throw new Error("Unsafe user financial total");
  return total;
}

function toLedgerTransaction(row: z.infer<typeof financeLedgerSchema>): LedgerTransaction {
  return {
    id: row.id,
    userId: row.user_id,
    type: row.type,
    status: row.status,
    amountCents: row.amount_cents,
    createdAt: row.created_at,
    provider: row.provider,
    providerTransactionId: row.provider_transaction_id,
    publisherRevenueCents: row.publisher_revenue_cents,
    description: "",
    idempotencyKey: "",
    metadata: {},
  };
}

/** Gross confirmed reward credits, reversals, paid withdrawals and wallet state per profile. */
export function calculateUserEarnings(
  profiles: z.infer<typeof profileSchema>[],
  ledger: z.infer<typeof financeLedgerSchema>[],
  withdrawals: z.infer<typeof userWithdrawalSchema>[],
  asOf: string
): UserEarningsRow[] {
  const asOfTime = Date.parse(asOf);
  const snapshotProfiles = profiles.filter(profile => Date.parse(profile.created_at) <= asOfTime);
  const rowsByUser = new Map<string, LedgerTransaction[]>(snapshotProfiles.map(({ id }) => [id, []]));
  const reportByUser = new Map<string, UserEarningsRow>(snapshotProfiles.map(({ id }) => [id, {
    userId: id,
    confirmedEarningsCents: 0,
    reversalCents: 0,
    reversalCount: 0,
    withdrawalCount: 0,
    paidWithdrawalCents: 0,
    paidWithdrawalCount: 0,
    availableCents: 0,
    reservedCents: 0,
    unconfirmedCents: 0,
  }]));

  for (const row of ledger) {
    if (Date.parse(row.created_at) > asOfTime) continue;
    const userLedger = rowsByUser.get(row.user_id);
    const report = reportByUser.get(row.user_id);
    if (!userLedger || !report) throw new Error("Ledger row has no matching profile");
    userLedger.push(toLedgerTransaction(row));
    if (row.status === "confirmed" && row.amount_cents > 0 && REWARD_TYPES.has(row.type)) {
      report.confirmedEarningsCents = addCents(report.confirmedEarningsCents, row.amount_cents);
    }
    if (row.status === "confirmed" && row.type === "reversal" && row.amount_cents < 0) {
      report.reversalCents = addCents(report.reversalCents, -row.amount_cents);
      report.reversalCount++;
    }
  }

  for (const request of withdrawals) {
    const report = reportByUser.get(request.user_id);
    if (!report) throw new Error("Withdrawal row has no matching profile");
    report.withdrawalCount++;
    if (request.status === "paid" && Date.parse(request.updated_at) <= Date.parse(asOf)) {
      report.paidWithdrawalCents = addCents(report.paidWithdrawalCents, request.amount_cents);
      report.paidWithdrawalCount++;
    }
  }

  for (const [userId, ledgerRows] of rowsByUser) {
    const wallet = summarizeLedger(ledgerRows);
    const report = reportByUser.get(userId)!;
    report.availableCents = wallet.availableCents;
    report.reservedCents = wallet.reservedCents;
    report.unconfirmedCents = wallet.pendingCents;
  }
  return [...reportByUser.values()];
}

function normalizeQuery(value: unknown): string {
  return typeof value === "string" ? value.trim().slice(0, 80) : "";
}

function normalizeSort(value: unknown): UserEarningsSort {
  if (value === "earnings_asc" || value === "user_id") return value;
  return "earnings_desc";
}

function normalizePage(value: unknown): number {
  if (typeof value !== "string" || !/^\d+$/.test(value)) return 1;
  const page = Number(value);
  return Number.isSafeInteger(page) && page > 0 ? page : 1;
}

export async function getUserEarningsPage(params: {
  query?: unknown;
  sort?: unknown;
  page?: unknown;
}): Promise<UserEarningsPage> {
  noStore();
  const user = await getSessionUser();
  if (!user || !isAdminEmail(user.email)) throw new Error("Forbidden");
  if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY) return { status: "unavailable" };

  try {
    const db = getSupabaseAdmin();
    const asOf = new Date().toISOString();
    const [profiles, ledger, withdrawals] = await Promise.all([
      readFinanceRows(db, "profiles", "id,created_at", "created_at", asOf, profileSchema),
      readFinanceRows(db, "ledger_transactions", "id,user_id,type,status,amount_cents,publisher_revenue_cents,provider,provider_transaction_id,created_at", "created_at", asOf, financeLedgerSchema),
      readFinanceRows(db, "withdrawal_requests", "id,user_id,amount_cents,status,created_at,updated_at", "created_at", asOf, userWithdrawalSchema),
    ]);
    if (profiles.length > MAX_USER_ROWS) throw new Error("User listing cap exceeded");

    const query = normalizeQuery(params.query);
    const sort = normalizeSort(params.sort);
    const matching = calculateUserEarnings(profiles, ledger, withdrawals, asOf)
      .filter(row => !query || row.userId.toLowerCase().includes(query.toLowerCase()));
    matching.sort((a, b) => {
      if (sort === "user_id") return a.userId.localeCompare(b.userId);
      const earningsOrder = a.confirmedEarningsCents === b.confirmedEarningsCents
        ? a.userId.localeCompare(b.userId)
        : a.confirmedEarningsCents < b.confirmedEarningsCents ? -1 : 1;
      return sort === "earnings_asc" ? earningsOrder : -earningsOrder;
    });

    const pageCount = Math.max(1, Math.ceil(matching.length / PAGE_SIZE));
    const page = Math.min(normalizePage(params.page), pageCount);
    const start = (page - 1) * PAGE_SIZE;
    return {
      status: "ready",
      users: matching.slice(start, start + PAGE_SIZE),
      totalUsers: matching.length,
      page,
      pageCount,
      query,
      sort,
      asOf,
    };
  } catch {
    // No partial rows or database error detail are exposed in this admin report.
    return { status: "unavailable" };
  }
}
