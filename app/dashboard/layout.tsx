import Link from "next/link";

const links = [
  ["Overview", "/dashboard"],
  ["Earn", "/dashboard/earn"],
  ["Wallet", "/dashboard/wallet"],
  ["Transactions", "/dashboard/transactions"],
  ["Profile", "/dashboard/profile"],
  ["Settings", "/dashboard/settings"],
];

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container grid gap-8 py-10 md:grid-cols-[220px_1fr]">
      <aside aria-label="Dashboard">
        <nav className="flex gap-2 overflow-x-auto md:flex-col">
          {links.map(([label, href]) => (
            <Link key={href + label} href={href} className="whitespace-nowrap rounded-xl px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted hover:text-foreground">
              {label}
            </Link>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
