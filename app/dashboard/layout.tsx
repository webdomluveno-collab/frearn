import Link from "next/link";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/auth/server";
import { SignOutButton } from "@/components/sign-out-button";

const links = [
  ["Overview", "/dashboard"],
  ["Earn", "/dashboard/earn"],
  ["Wallet", "/dashboard/wallet"],
  ["Transactions", "/dashboard/transactions"],
  ["Profile", "/dashboard/profile"],
  ["Settings", "/dashboard/settings"],
];

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const user = await getSessionUser();
  // Unconfigured (no Supabase) or signed out → sign in. The CPX wall requires a real user.
  if (!user) redirect("/login");

  return (
    <div className="container grid gap-8 py-10 md:grid-cols-[220px_1fr]">
      <aside aria-label="Dashboard">
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {links.map(([label, href]) => (
            <Link key={href + label} href={href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {label}
            </Link>
          ))}
          <SignOutButton />
        </nav>
        <p className="mt-3 hidden truncate px-3 text-xs text-muted-foreground md:block" title={user.email ?? undefined}>
          {user.email}
        </p>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
