import "server-only";

import { getSupabaseAdmin } from "@/lib/auth/server";
import type { WithdrawalRequest, WithdrawalStatus } from "@/types";

/** Extended row: request + review bookkeeping (admin sees full destination; users get masked UI). */
export interface WithdrawalRequestRow extends WithdrawalRequest {
  ledgerTransactionId: string | null;
  idempotencyKey: string;
  updatedAt: string;
  reviewedBy: string | null;
  failureReason: string | null;
}

const WITHDRAWAL_ERROR_CODES = new Set([
  "invalid_amount",
  "below_minimum",
  "invalid_method",
  "invalid_destination",
  "insufficient_balance",
  "pending_withdrawal",
  "invalid_request",
  "invalid_action",
  "invalid_transition",
  "not_found",
]);

function mapRpcError(message: string): string {
  const code = message.trim().split("\n")[0];
  return WITHDRAWAL_ERROR_CODES.has(code) ? code : "unavailable";
}

function toRow(r: Record<string, unknown>): WithdrawalRequestRow {
  return {
    id: r.id as string,
    userId: r.user_id as string,
    amountCents: r.amount_cents as number,
    method: r.method as string,
    destination: r.destination as string,
    status: r.status as WithdrawalStatus,
    createdAt: r.created_at as string,
    ledgerTransactionId: (r.ledger_transaction_id as string | null) ?? null,
    idempotencyKey: (r.idempotency_key as string) ?? "",
    updatedAt: (r.updated_at as string) ?? (r.created_at as string),
    reviewedBy: (r.reviewed_by as string | null) ?? null,
    failureReason: (r.failure_reason as string | null) ?? null,
  };
}

const ROW_COLUMNS =
  "id,user_id,amount_cents,method,destination,status,created_at,ledger_transaction_id,idempotency_key,updated_at,reviewed_by,failure_reason";

export interface RequestWithdrawalInput {
  userId: string;
  amountCents: number;
  method: string;
  destination: string;
  idempotencyKey: string;
}

export interface RequestWithdrawalResult {
  ok: true;
  request: WithdrawalRequestRow;
  duplicate: boolean;
}

export type RequestWithdrawalFailure = { ok: false; error: string };

/**
 * Atomic reserve-on-request via request_withdrawal() RPC.
 * Concurrency, balance math, and duplicate collapse all happen in one
 * transaction — application code never checks-then-inserts.
 */
export async function requestWithdrawal(
  input: RequestWithdrawalInput
): Promise<RequestWithdrawalResult | RequestWithdrawalFailure> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("request_withdrawal", {
    p_user_id: input.userId,
    p_amount_cents: input.amountCents,
    p_method: input.method,
    p_destination: input.destination,
    p_idempotency_key: input.idempotencyKey,
  });
  if (error) return { ok: false, error: mapRpcError(error.message) };
  const out = (Array.isArray(data) ? data[0] : data) as {
    request_id: string;
    ledger_id: string;
    is_duplicate: boolean;
  };
  const { data: row, error: readError } = await db
    .from("withdrawal_requests")
    .select(ROW_COLUMNS)
    .eq("id", out.request_id)
    .eq("user_id", input.userId)
    .single();
  if (readError || !row) return { ok: false, error: "unavailable" };
  return { ok: true, request: toRow(row as Record<string, unknown>), duplicate: out.is_duplicate };
}

/** Own requests, newest first (masked by callers before display). */
export async function listMyWithdrawals(userId: string): Promise<WithdrawalRequestRow[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("withdrawal_requests")
    .select(ROW_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw new Error(`withdrawal read failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toRow);
}

/** Pending queue for operators. Service-role only; caller must verify admin. */
export async function listPendingWithdrawals(): Promise<WithdrawalRequestRow[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from("withdrawal_requests")
    .select(ROW_COLUMNS)
    .in("status", ["requested", "reviewing", "approved", "processing"])
    .order("created_at", { ascending: true })
    .limit(100);
  if (error) throw new Error(`withdrawal queue read failed: ${error.message}`);
  return ((data ?? []) as Record<string, unknown>[]).map(toRow);
}

export interface SettleResult {
  ok: true;
  requestId: string;
  newStatus: string;
  already: boolean;
}

/** Idempotent admin transition via settle_withdrawal() RPC. Caller must verify admin. */
export async function settleWithdrawal(
  requestId: string,
  action: "paid" | "rejected",
  actor: string
): Promise<SettleResult | RequestWithdrawalFailure> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.rpc("settle_withdrawal", {
    p_request_id: requestId,
    p_action: action,
    p_actor: actor,
  });
  if (error) return { ok: false, error: mapRpcError(error.message) };
  const out = (Array.isArray(data) ? data[0] : data) as {
    request_id: string;
    new_status: string;
    already: boolean;
  };
  return { ok: true, requestId: out.request_id, newStatus: out.new_status, already: out.already };
}
