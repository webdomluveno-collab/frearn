"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { isKnownWithdrawalMethod, WITHDRAWAL_METHOD_META } from "@/lib/withdrawals";
import { centsToUsd } from "@/lib/money";

export interface AdminWithdrawalRow {
  id: string;
  userId: string;
  amountCents: number;
  method: string;
  destination: string;
  status: string;
  createdAt: string;
}

/**
 * Operator review actions. Reads are server-rendered (full destinations stay
 * server-side); only approve/reject POSTs happen here. Both actions are
 * idempotent server-side — repeated clicks cannot double-pay or double-refund.
 */
export function AdminWithdrawalActions({ rows }: { rows: AdminWithdrawalRow[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function act(id: string, action: "approve" | "reject") {
    if (busy) return;
    setBusy(`${action}:${id}`);
    setError(null);
    try {
      const res = await fetch(`/api/admin/withdrawals/${id}/${action}`, {
        method: "POST",
        credentials: "same-origin",
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "unavailable");
        return;
      }
      router.refresh();
    } catch {
      setError("unavailable");
    } finally {
      setBusy(null);
    }
  }

  if (rows.length === 0) {
    return <p className="mt-3 rounded-2xl border p-6 text-sm text-muted-foreground">No pending withdrawals.</p>;
  }

  return (
    <div className="mt-3 overflow-x-auto rounded-2xl border">
      {error && (
        <p className="border-b p-3 text-sm text-red-600" role="alert">
          Action failed: {error}
        </p>
      )}
      <table className="w-full min-w-[860px] text-sm">
        <thead>
          <tr className="bg-muted/50 text-left text-xs text-muted-foreground">
            <th className="p-3">Created</th>
            <th className="p-3">User</th>
            <th className="p-3 text-right">Amount</th>
            <th className="p-3">Method</th>
            <th className="p-3">Destination</th>
            <th className="p-3">Status</th>
            <th className="p-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            const key = `${r.id}`;
            return (
              <tr key={r.id} className="border-t">
                <td className="p-3">{new Date(r.createdAt).toLocaleString("en-US")}</td>
                <td className="p-3 font-mono text-xs">{r.userId.slice(0, 8)}…</td>
                <td className="p-3 text-right">{centsToUsd(r.amountCents)}</td>
                <td className="p-3">{isKnownWithdrawalMethod(r.method) ? WITHDRAWAL_METHOD_META[r.method].label : r.method}</td>
                <td className="p-3 font-mono text-xs">{r.destination}</td>
                <td className="p-3 font-mono text-xs">{r.status}</td>
                <td className="p-3 text-right">
                  <span className="inline-flex gap-2">
                    <Button
                      size="sm"
                      disabled={busy !== null}
                      onClick={() => void act(key, "approve")}
                    >
                      {busy === `approve:${key}` ? "…" : "Mark paid"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={busy !== null}
                      onClick={() => void act(key, "reject")}
                    >
                      {busy === `reject:${key}` ? "…" : "Reject"}
                    </Button>
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="p-3 text-xs text-muted-foreground">
        Pay out manually using the destination shown, then mark paid. Rejecting returns reserved
        funds automatically. Repeat actions are safe no-ops.
      </p>
    </div>
  );
}
