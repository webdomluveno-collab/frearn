import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const tones: Record<string, string> = {
  default: "bg-muted text-foreground",
  success: "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/20",
  warning: "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20",
  info: "bg-primary/10 text-primary border-primary/20",
  neutral: "bg-muted text-muted-foreground",
};

export function Badge({ tone = "default", className, ...props }: HTMLAttributes<HTMLSpanElement> & { tone?: keyof typeof tones }) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium",
        tones[tone],
        className
      )}
      {...props}
    />
  );
}

export function StatusBadge({ status }: { status: string }) {
  const s = status.toLowerCase();
  if (s === "confirmed" || s === "completed" || s === "paid" || s === "approved")
    return <Badge tone="success">{status}</Badge>;
  if (s === "pending" || s === "requested" || s === "reviewing" || s === "processing")
    return <Badge tone="warning">{status}</Badge>;
  if (s === "reversed" || s === "rejected") return <Badge tone="neutral">{status}</Badge>;
  return <Badge>{status}</Badge>;
}
