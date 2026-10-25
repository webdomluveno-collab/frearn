import Link from "next/link";
import { ArrowLeft, ArrowLeftRight, ArrowRight, Search, Users } from "lucide-react";
import { centsToUsd } from "@/lib/money";
import type { UserEarningsPage } from "@/lib/admin/user-earnings";
import styles from "./users-earnings.module.css";

const money = (cents: number) => centsToUsd(cents);

function pageHref(report: Extract<UserEarningsPage, { status: "ready" }>, page: number) {
  const params = new URLSearchParams();
  if (report.query) params.set("q", report.query);
  params.set("sort", report.sort);
  params.set("page", String(page));
  return `/admin/users-and-earnings?${params.toString()}`;
}

export function UsersEarningsView({ report }: { report: UserEarningsPage }) {
  const ready = report.status === "ready" ? report : null;
  return <main className={styles.root}>
    <div className={styles.wrap}>
      <nav className={styles.nav} aria-label="Admin navigation">
        <Link href="/admin"><ArrowLeft size={16}/> Admin tools</Link>
        <Link href="/admin/control-center">Control Center <ArrowRight size={14}/></Link>
        <span><Users size={15}/> Read-only · Admin</span>
      </nav>
      <header className={styles.header}>
        <p className={styles.eyebrow}>ACCOUNT LEDGER VIEW</p>
        <h1>Users &amp; earnings</h1>
        <p>Confirmed reward credits, reversals, paid requests and today&apos;s ledger balance. No email or payment destinations are shown.</p>
      </header>
      {ready ? <>
        <section className={styles.controls} aria-label="Search and sort users">
          <form method="get" action="/admin/users-and-earnings" className={styles.filters}>
            <label htmlFor="user-search">Search by user ID</label>
            <div className={styles.searchBox}><Search size={17}/><input id="user-search" name="q" type="search" maxLength={80} defaultValue={ready.query} placeholder="Paste part of a user ID" autoComplete="off"/><input type="hidden" name="page" value="1"/></div>
            <label htmlFor="user-sort">Sort</label>
            <select id="user-sort" name="sort" defaultValue={ready.sort}>
              <option value="earnings_desc">Earnings: highest first</option>
              <option value="earnings_asc">Earnings: lowest first</option>
              <option value="user_id">User ID</option>
            </select>
            <button type="submit">Apply</button>
          </form>
          <div className={styles.snapshot}><strong>{ready.totalUsers.toLocaleString("en-US")}</strong> matching users<span/>Snapshot started {new Date(ready.asOf).toLocaleString("en-GB", { timeZone: "UTC" })} UTC</div>
        </section>
        <p className={styles.explainer}><ArrowLeftRight size={15}/> Earnings are gross confirmed survey, offer and referral credits. Reversals are shown separately. Paid totals use requests marked paid; available and reserved balances use the existing per-user ledger calculation.</p>
        {ready.users.length ? <div className={styles.tableScroll}>
          <table>
            <caption>Per-user financial summary. IDs only; no contact or payout details.</caption>
            <thead><tr>
              <th scope="col">User ID</th><th scope="col">Confirmed earnings</th><th scope="col">Reversals</th>
              <th scope="col">Paid withdrawals</th><th scope="col">All requests</th><th scope="col">Available</th><th scope="col">Reserved</th><th scope="col">Pending credits</th>
            </tr></thead>
            <tbody>{ready.users.map(user => <tr key={user.userId}>
              <th scope="row"><code title={user.userId}>{user.userId}</code></th>
              <td>{money(user.confirmedEarningsCents)}</td>
              <td>{user.reversalCents ? `−${money(user.reversalCents)}` : money(0)}{user.reversalCount > 0 && <small>{user.reversalCount} entries</small>}</td>
              <td>{money(user.paidWithdrawalCents)}<small>{user.paidWithdrawalCount} paid</small></td><td>{user.withdrawalCount}</td>
              <td>{money(user.availableCents)}</td><td>{money(user.reservedCents)}</td><td>{money(user.unconfirmedCents)}</td>
            </tr>)}</tbody>
          </table>
        </div> : <div className={styles.empty} role="status">{ready.query ? "No users match that ID." : "No user profiles are available."}</div>}
        <nav className={styles.pagination} aria-label="User list pages">
          <span>Page {ready.page} of {ready.pageCount}</span>
          <div>
            {ready.page > 1 ? <Link href={pageHref(ready, ready.page - 1)}><ArrowLeft size={15}/> Previous</Link> : <span aria-disabled="true"><ArrowLeft size={15}/> Previous</span>}
            {ready.page < ready.pageCount ? <Link href={pageHref(ready, ready.page + 1)}>Next <ArrowRight size={15}/></Link> : <span aria-disabled="true">Next <ArrowRight size={15}/></span>}
          </div>
        </nav>
        <p className={styles.footnote}>Paginated source reads are capped and must complete in full. This operational view is not an atomic accounting snapshot. IDs can be copied for internal support; emails and payment destinations are intentionally omitted.</p>
      </> : <div className={styles.unavailable} role="status"><strong>User financial data: Not available.</strong><p>The database is unconfigured, unavailable, or a complete paginated read could not be validated. No partial totals are shown.</p><Link href="/admin/users-and-earnings">Try again</Link></div>}
    </div>
  </main>;
}
