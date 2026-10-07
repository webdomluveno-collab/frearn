"use client";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
/** Homepage and auth own their chrome; legal/support routes retain shared navigation. */
export function PublicFrame({ children, header, footer }: { children: ReactNode; header: ReactNode; footer: ReactNode }) {
  const pathname = usePathname();
  const standalone = ["/", "/login", "/register", "/forgot-password", "/reset-password"].includes(pathname);
  return <>{!standalone && header}<div id="main">{children}</div>{!standalone && footer}</>;
}
