import "server-only";
import { z } from "zod";
import { unstable_noStore as noStore } from "next/cache";
import { getSessionUser, getSupabaseAdmin, isAdminEmail, isSupabaseConfigured } from "@/lib/auth/server";
import { summarizeLedger } from "@/lib/wallet/ledger";
import type { LedgerTransaction } from "@/types";
export type FinancePeriod = "7" | "30" | "all";
export function financePeriod(value: unknown): FinancePeriod {
    return value === "7" || value === "30" ? value : "all";
}
const cents = z.number().int().safe();
const timestamp = z.string().datetime({ offset: true });
export const financeLedgerSchema = z.object({
    id: z.string(), user_id: z.string(), type: z.enum(["survey_reward", "offer_reward", "adjustment", "withdrawal", "reversal", "referral_reward"]),
    status: z.enum(["confirmed", "pending", "reversed"]), amount_cents: cents,
    publisher_revenue_cents: cents, provider: z.string().nullable(), provider_transaction_id: z.string().nullable(), created_at: timestamp,
});
export const financeWithdrawalSchema = z.object({
    id: z.string(), amount_cents: cents.positive(),
    status: z.enum(["requested", "reviewing", "approved", "processing", "paid", "rejected"]),
    created_at: timestamp, updated_at: timestamp,
});
export const financeEventSchema = z.object({ id: z.string(), provider: z.string(), processing_status: z.string(), received_at: timestamp });
export type FinanceLedger = z.infer<typeof financeLedgerSchema>;
export type FinanceWithdrawal = z.infer<typeof financeWithdrawalSchema>;
export type FinanceEvent = z.infer<typeof financeEventSchema>;
const ACTIVE = new Set(["requested", "reviewing", "approved", "processing"]);
function add(a: number, b: number): number {
    const sum = a + b;
    if (!Number.isSafeInteger(sum))
        throw new Error("Unsafe financial total");
    return sum;
}
const sum = (rows: FinanceLedger[], field: "amount_cents" | "publisher_revenue_cents") => rows.reduce((n, r) => add(n, r[field]), 0);
/** Server-side only. Gross credit-time figures are NOT provider cash receipts or net profit. */
export function calculateFinance(ledger: FinanceLedger[], withdrawals: FinanceWithdrawal[], events: FinanceEvent[], period: FinancePeriod, asOf: string) {
    const end = Date.parse(asOf);
    ledger = ledger.filter(r => Date.parse(r.created_at) <= end);
    withdrawals = withdrawals.filter(r => Date.parse(r.created_at) <= end);
    const start = period === "all" ? -Infinity : end - Number(period) * 86400000;
    const inPeriod = (value: string) => Date.parse(value) >= start && Date.parse(value) <= end;
    const surveyOfferRewards = ledger.filter(r => r.status === "confirmed" && r.amount_cents > 0 && (r.type === "survey_reward" || r.type === "offer_reward") && inPeriod(r.created_at));
    const referralRewards = ledger.filter(r => r.status === "confirmed" && r.type === "referral_reward" && r.amount_cents > 0 && inPeriod(r.created_at));
    // Only known mappings whose callback code persists publisher cents on the unique credit.
    const knownProviders = ["cpx", "adgem", "timewall"];
    const providers = [...new Set([...knownProviders, ...surveyOfferRewards.map(r => r.provider ?? "unattributed")])].sort().map(provider => {
        const rows = surveyOfferRewards.filter(r => (r.provider ?? "unattributed") === provider);
        const covered = knownProviders.includes(provider) && rows.every(r => r.provider_transaction_id && r.publisher_revenue_cents >= 0);
        return { provider, credits: rows.length, rewardsCents: sum(rows, "amount_cents"), revenueCents: covered ? sum(rows, "publisher_revenue_cents") : null };
    });
    const revenueCovered = providers.every(p => p.revenueCents !== null);
    const reportedRevenueCents = revenueCovered ? providers.reduce((n, p) => add(n, p.revenueCents!), 0) : null;
    const surveyOfferRewardsCents = sum(surveyOfferRewards, "amount_cents");
    const referralRewardsCents = sum(referralRewards, "amount_cents");
    const totalRewardCostsCents = add(surveyOfferRewardsCents, referralRewardsCents);
    const paid = withdrawals.filter(r => r.status === "paid" && inPeriod(r.updated_at));
    const pending = withdrawals.filter(r => ACTIVE.has(r.status));
    const reversals = ledger.filter(r => r.type === "reversal" && r.status === "confirmed" && r.amount_cents < 0 && inPeriod(r.created_at));
    const released = ledger.filter(r => r.type === "reversal" && r.status === "confirmed" && r.amount_cents === 0 && r.provider === "manual" && inPeriod(r.created_at));
    const users = new Map<string, LedgerTransaction[]>();
    for (const r of ledger) {
        const rows = users.get(r.user_id) ?? [];
        rows.push({ id: r.id, userId: r.user_id, type: r.type, status: r.status, amountCents: r.amount_cents, createdAt: r.created_at,
            provider: r.provider, providerTransactionId: r.provider_transaction_id, publisherRevenueCents: r.publisher_revenue_cents,
            description: "", idempotencyKey: "", metadata: {} });
        users.set(r.user_id, rows);
    }
    let availableCents = 0, reservedCents = 0, unconfirmedCents = 0, deficitCents = 0;
    for (const rows of users.values()) {
        const wallet = summarizeLedger(rows);
        availableCents = add(availableCents, wallet.availableCents);
        reservedCents = add(reservedCents, wallet.reservedCents);
        unconfirmedCents = add(unconfirmedCents, wallet.pendingCents);
        const raw = rows.filter(r => r.status === "confirmed").reduce((n, r) => add(n, r.amountCents), 0);
        deficitCents = add(deficitCents, Math.max(0, -raw));
    }
    return {
        asOf, period, providers, surveyOfferRewardsCents, referralRewardsCents, totalRewardCostsCents, reportedRevenueCents,
        creditSpreadCents: reportedRevenueCents === null ? null : add(reportedRevenueCents, -totalRewardCostsCents),
        paid: { count: paid.length, cents: paid.reduce((n, r) => add(n, r.amount_cents), 0) },
        pending: { count: pending.length, cents: pending.reduce((n, r) => add(n, r.amount_cents), 0) },
        liabilities: { availableCents, reservedCents, totalCents: add(availableCents, reservedCents), unconfirmedCents, deficitCents },
        reversals: { count: reversals.length, cents: Math.abs(sum(reversals, "amount_cents")), releasedHolds: released.length },
        activeUsers: new Set(surveyOfferRewards.map(r => r.user_id)).size,
        events: { count: events.filter(r => inPeriod(r.received_at)).length,
            held: events.filter(r => inPeriod(r.received_at) && r.processing_status === "held").length,
            rejected: events.filter(r => inPeriod(r.received_at) && ["rejected", "orphan_reversal"].includes(r.processing_status)).length },
    };
}
export type FinanceReport = ReturnType<typeof calculateFinance>;
const PAGE_SIZE = 500;
const MAX_ROWS = 50000;
/** Complete reads only: never silently use the usual PostgREST first-1000-row default. */
export async function readFinanceRows<T>(db: ReturnType<typeof getSupabaseAdmin>, table: string, columns: string, dateColumn: string, asOf: string, schema: z.ZodType<T>): Promise<T[]> {
    const rows: T[] = [];
    let expected: number | null = null;
    while (expected === null || rows.length < expected) {
        const { data, error, count } = await db.from(table).select(columns, { count: "exact" })
            .lte(dateColumn, asOf).order("id", { ascending: true }).range(rows.length, rows.length + PAGE_SIZE - 1);
        if (error || !data || count === null || count > MAX_ROWS || (expected !== null && count !== expected))
            throw new Error("Incomplete financial read");
        expected = count;
        if (data.length !== Math.min(PAGE_SIZE, expected - rows.length))
            throw new Error("Truncated financial read");
        rows.push(...data.map(row => schema.parse(row)));
        if (new Set(rows.map(row => (row as {
            id: string;
        }).id)).size !== rows.length)
            throw new Error("Unstable financial read");
    }
    return rows;
}
export type FinanceResult = {
    status: "ready";
    report: FinanceReport;
} | {
    status: "unavailable";
};
/** Auth is checked BEFORE constructing the service client. No public API or client aggregation. */
export async function getControlCenter(period: FinancePeriod): Promise<FinanceResult> {
    noStore();
    const user = await getSessionUser();
    if (!user || !isAdminEmail(user.email))
        throw new Error("Forbidden");
    if (!isSupabaseConfigured() || !process.env.SUPABASE_SERVICE_ROLE_KEY)
        return { status: "unavailable" };
    try {
        const db = getSupabaseAdmin();
        const asOf = new Date().toISOString();
        const [ledger, withdrawals, events] = await Promise.all([
            readFinanceRows(db, "ledger_transactions", "id,user_id,type,status,amount_cents,publisher_revenue_cents,provider,provider_transaction_id,created_at", "created_at", asOf, financeLedgerSchema),
            readFinanceRows(db, "withdrawal_requests", "id,amount_cents,status,created_at,updated_at", "created_at", asOf, financeWithdrawalSchema),
            readFinanceRows(db, "provider_events", "id,provider,processing_status,received_at", "received_at", asOf, financeEventSchema),
        ]);
        return { status: "ready", report: calculateFinance(ledger, withdrawals, events, period, asOf) };
    }
    catch {
        // Never expose PostgREST messages, keys, row contents or partial/false-zero financial totals.
        return { status: "unavailable" };
    }
}
