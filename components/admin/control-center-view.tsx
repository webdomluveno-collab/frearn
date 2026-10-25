import Link from "next/link";
import { ArrowLeft, ArrowUpRight, LockKeyhole, Sparkles } from "lucide-react";
import { centsToUsd } from "@/lib/money";
import type { FinancePeriod, FinanceResult } from "@/lib/admin/control-center";
import styles from "./control-center.module.css";
const money = (value: number | null | undefined) => value == null ? "Not available" : centsToUsd(value);
function Metric({ label, value, detail, accent }: {
    label: string;
    value: string;
    detail: string;
    accent?: boolean;
}) {
    return <article className={`${styles.card} ${accent ? styles.accent : ""}`}><h2>{label}</h2><p className={styles.value}>{value}</p><p className={styles.detail}>{detail}</p></article>;
}
export function ControlCenterView({ result, period }: {
    result: FinanceResult;
    period: FinancePeriod;
}) {
    const r = result.status === "ready" ? result.report : null;
    return <main className={styles.root}>
    <div className={styles.wrap}>
      <nav className={styles.nav} aria-label="Admin navigation"><Link href="/admin"><ArrowLeft size={16}/> Admin tools</Link><span><LockKeyhole size={15}/> Read-only · Admin</span></nav>
      <header className={styles.header}><div><p className={styles.eyebrow}>FREEARN / OPERATIONS</p><h1>Control Center<span>✳</span></h1><p className={styles.intro}>A clear view of the money. Every number has a source.</p></div><div className={styles.seal}><Sparkles /><span>Real records.<br />Clear boundaries.</span></div></header>
      <div className={styles.toolbar}><nav aria-label="Financial reporting period" className={styles.filters}>{([["7", "7 days"], ["30", "30 days"], ["all", "All time"]] as const).map(([value, label]) => <Link key={value} href={`/admin/control-center?period=${value}`} aria-current={period === value ? "page" : undefined}>{label}</Link>)}</nav><p>Rolling UTC window · current balances stay current</p></div>
      {r ? <p className={styles.notice}>Read started {new Date(r.asOf).toLocaleString("en-GB", { timeZone: "UTC" })} UTC. Paginated operational reads, not an atomic accounting snapshot. Refresh after concurrent settlements.</p> : <div className={styles.notice} role="status"><strong>Financial data: Not available.</strong> The database is unconfigured, unavailable, or could not be read completely. No partial totals are shown. <Link href={`/admin/control-center?period=${period}`}>Try again <ArrowUpRight size={14}/></Link></div>}
      <section aria-label="Financial overview" className={styles.grid}>
        <Metric label="Reported publisher revenue" value={money(r?.reportedRevenueCents)} detail="Gross revenue stored on confirmed reward credits in this period. Not provider cash received." accent/>
        <Metric label="User rewards credited" value={money(r?.rewardsCents)} detail="Positive confirmed survey and offer rewards. Before subsequent reversals; excludes adjustments."/>
        <Metric label="Credit-time spread" value={money(r?.creditSpreadCents)} detail="Reported revenue minus those rewards, before chargebacks, fees and costs. Not net profit."/>
        <Metric label="Active rewarded users" value={r ? String(r.activeUsers) : "Not available"} detail="Distinct users with a positive confirmed survey or offer reward in the selected period. Not website visitors."/>
        <Metric label="Paid withdrawals · recorded" value={money(r?.paid.cents)} detail={r ? `${r.paid.count} requests marked paid, by updated_at in the selected period. Gross amount; not bank reconciliation.` : "Paid status and last status-update time; not request creation time."}/>
        <Metric label="Pending withdrawals · now" value={money(r?.pending.cents)} detail={r ? `${r.pending.count} requests: requested, reviewing, approved or processing. All ages; unaffected by the period filter.` : "All open requests, regardless of creation date."}/>
        <Metric label="Current wallet liabilities" value={money(r?.liabilities.totalCents)} detail="Available balances plus pending withdrawal reservations, per user. Never net one user's deficit against another's balance." accent/>
        <Metric label="Reward reversals" value={money(r?.reversals.cents)} detail={r ? `${r.reversals.count} confirmed negative reversal entries in this period. ${r.reversals.releasedHolds} zero-value rejected-withdrawal markers shown separately.` : "Confirmed negative reversal entries. Zero-value rejected-withdrawal markers are not lost rewards."}/>
      </section>
      <section className={styles.section} aria-labelledby="providers"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>CREDIT-BACKED REPORTING</p><h2 id="providers">By provider</h2></div><span className={styles.pill}>USD · integer cents</span></div>
        <p className={styles.detail}>Ledger credits are counted once by their unique transaction. Held, rejected and duplicate callbacks do not create additional revenue here. This is not a complete provider invoice statement.</p>
        {r ? <><div className={styles.providers}>{r.providers.map(p => <article key={p.provider} className={styles.provider}><h3>{p.provider}</h3><dl><div><dt>Reported revenue</dt><dd>{money(p.revenueCents)}</dd></div><div><dt>User rewards</dt><dd>{money(p.rewardsCents)}</dd></div><div><dt>Reward credits</dt><dd>{p.credits}</dd></div></dl></article>)}</div>{r.rewardsCents === 0 && <p className={styles.empty}>No confirmed positive rewards in this period. Held callbacks and survey opens are not earnings.</p>}<p className={styles.detail}>Provider audit events in period: {r.events.count}; held: {r.events.held}; rejected or orphan reversals: {r.events.rejected}. Event status is diagnostic, not financial proof.</p></> : <p className={styles.empty}>Provider totals: Not available.</p>}
      </section>
      <section className={styles.section} aria-labelledby="balances"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>POINT-IN-TIME VIEW</p><h2 id="balances">What users can withdraw</h2></div></div><dl className={styles.breakdown}><div><dt>Available · after pending holds</dt><dd>{money(r?.liabilities.availableCents)}</dd></div><div><dt>Reserved for pending withdrawals</dt><dd>{money(r?.liabilities.reservedCents)}</dd></div><div><dt>Unconfirmed positive credits · excluded from liabilities</dt><dd>{money(r?.liabilities.unconfirmedCents)}</dd></div><div><dt>Negative confirmed balances · separate review amount</dt><dd>{money(r?.liabilities.deficitCents)}</dd></div></dl><p className={styles.detail}>Uses the same wallet summary rules as the customer UI. Reversed rows are excluded; confirmed withdrawals are already debited. Reservations are included once in liabilities and must not be added a second time from the pending-request card.</p></section>
      <section className={styles.section} aria-labelledby="unknown"><div className={styles.sectionHeading}><div><p className={styles.eyebrow}>HONEST ACCOUNTING</p><h2 id="unknown">What the records cannot tell us</h2></div></div><dl className={styles.breakdown}>{["Provider payments actually received", "Reconciled gross margin after provider chargebacks", "Advertising spend", "Other operating costs and actual transfer fees", "Net profit"].map(label => <div key={label}><dt>{label}</dt><dd>Not available</dd></div>)}</dl><p className={styles.detail}>There is no provider settlement, expense or fee ledger in the current schema. Reported revenue minus withdrawals is not profit. A paid request records an operator action, not independent proof of transfer or its net received amount.</p></section>
      <section className={styles.integrations} aria-label="Planned integrations"><article><span className={styles.pill}>Integration plan only</span><h2>Telegram notifications</h2><p>Signup relay exists in code. Withdrawal deployment, migration and separate Vault URL are unverified. Reward alerts must follow the first durable confirmed credit.</p></article><article><span className={styles.pill}>Not connected</span><h2>Traffic & conversions</h2><p>Umami integration is planned. Visitors, countries, sources, UTM campaigns and signup conversions: <strong>Not available.</strong></p></article></section>
      <footer className={styles.footer}>No balance mutations. No payout actions. Financial figures stay behind the existing admin authorization.</footer>
    </div>
  </main>;
}
