import Link from "next/link";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { centsToUsd } from "@/lib/money";
import { PAYOUT_RULES } from "@/lib/withdrawals";
import { siteConfig } from "@/config/site";
import { displayName, toFxTransaction, weekBuckets } from "@/lib/fx";
import { getSurveyWall } from "@/lib/providers";
import { ButtonLink } from "@/components/fx/primitives";
import { Icon } from "@/components/fx/icon";
import { OpportunityArt } from "@/components/fx/opportunity-art";
import { TallyMark } from "@/components/fx/tally";
import { TransactionList } from "@/components/fx/transactions";

export default async function DashboardOverview() {
  const user = await getSessionUser();
  const txns = await getMyLedger(user?.id ?? null);
  const s = summarizeLedger(txns);
  const name = displayName(user?.email);
  const fresh = txns.length === 0;
  const week = weekBuckets(txns);
  const weekTotal = week.reduce((sum, b) => sum + b.cents, 0);
  const weekMax = Math.max(1, ...week.map((b) => b.cents));
  const cpxLive = getSurveyWall("cpx")?.isConfigured() ?? false;

  return (
    <>
      <div className="today-heading">
        <div>
          <span className="eyebrow">TODAY ON FREEARN</span>
          <h1>{fresh ? `Your first mark, ${name}.` : `Take it from here, ${name}.`}</h1>
        </div>
        <span className="today-issue">
          YOUR TIME
          <br />
          <b>ADDS UP.</b>
          <TallyMark size={36} />
        </span>
      </div>
      <section className="dashboard-money" aria-label="Your balances">
        <div className="balance-card">
          <span className="eyebrow"><Icon name="wallet" size={17} />AVAILABLE TO WITHDRAW</span>
          <strong className="balance-amount">{centsToUsd(s.availableCents)} <small>USD</small></strong>
          <p>Confirmed rewards. Ready for your next little move.</p>
          <div className="balance-actions">
            <ButtonLink href="/dashboard/wallet" variant="lime">
              {s.availableCents < siteConfig.withdrawalsFromCents
                ? `Withdraw from ${centsToUsd(siteConfig.withdrawalsFromCents)}`
                : "Withdraw rewards"}
              <Icon name="external" size={17} />
            </ButtonLink>
            <ButtonLink href="/dashboard/earn" variant="ghost">Explore Earn <Icon name="chevron" size={17} /></ButtonLink>
          </div>
          <div className="balance-decoration" aria-hidden="true"><i /><i /><i /></div>
        </div>
        <div className="balance-summary">
          <div className="summary-card summary-pending">
            <span className="summary-icon"><Icon name="clock" size={22} /></span>
            <div><span>Pending rewards</span><strong>{centsToUsd(s.pendingCents)}</strong><p>Awaiting confirmation</p></div>
          </div>
          <div className="summary-card summary-lifetime">
            <span className="summary-icon"><Icon name="reward" size={22} /></span>
            <div><span>Lifetime earnings</span><strong>{centsToUsd(s.lifetimeCents)}</strong><p>Confirmed over time</p></div>
          </div>
        </div>
      </section>
      <div className="payout-reminder">
        <span className="reminder-icon"><Icon name="wallet" size={20} /></span>
        <p>Small minimum. A clear next step.<small>Revolut / native crypto from {centsToUsd(PAYOUT_RULES.revolut.minimumCents)} · Other crypto / Skrill from {centsToUsd(PAYOUT_RULES.sol.minimumCents)} (Skrill fees deducted)</small></p>
        <Link href="/dashboard/wallet" className="text-link">See wallet &amp; history <Icon name="external" size={16} /></Link>
      </div>
      <section className="opportunity-section">
        <div className="section-title">
          <div>
            <span className="eyebrow">01 / YOUR NEXT SMALL THING</span>
            <h2>Things worth your time.</h2>
          </div>
          <Link href="/dashboard/earn" className="text-link">
            Open Earn
          </Link>
        </div>
        <div className="provider-shelf">
          <Link
            href="/dashboard/earn?provider=surveys"
            className="provider-card"
            aria-label={`Surveys, ${cpxLive ? "available now" : "preparing for your region"}`}
          >
            <OpportunityArt
              opportunity={{ art: "survey", accent: "lavender", category: "surveys", title: "surveys" }}
            />
            <div>
              <h3>Surveys</h3>
              <span>{cpxLive ? "Available now" : "Preparing for your region"}</span>
            </div>
            <Icon name="chevron" size={18} />
          </Link>
          <Link
            href="/dashboard/earn?provider=offers"
            className="provider-card"
            aria-label="Offers and games, availability varies"
          >
            <OpportunityArt
              opportunity={{ art: "garden", accent: "green", category: "offers", title: "offers", wordmark: ["OFFERS", "& GAMES"] }}
            />
            <div>
              <h3>Offers &amp; Games</h3>
              <span>Availability varies</span>
            </div>
            <Icon name="chevron" size={18} />
          </Link>
        </div>
      </section>
      <div className="overview-bottom">
        <section className="surface recent-panel">
          <div className="section-title">
            <div>
              <span className="eyebrow">02 / WHAT’S CHANGED</span>
              <h2>{fresh ? "A fresh page." : "Your latest marks."}</h2>
            </div>
            <Link href="/dashboard/transactions" className="text-link">
              See all ↗
            </Link>
          </div>
          {fresh ? (
            <div className="new-activity">
              <TallyMark size={42} />
              <h3>Your story starts here.</h3>
              <p>Your first confirmed reward will appear here.</p>
              <Link href="/dashboard/earn" className="text-link">
                Find an opportunity
              </Link>
            </div>
          ) : (
            <TransactionList items={txns.slice(0, 3).map(toFxTransaction)} compact />
          )}
        </section>
        <section className="surface week-panel">
          <div className="section-title">
            <h2>This week, so far.</h2>
          </div>
          <div className="week-summary">
            <strong>{centsToUsd(weekTotal)}</strong>
            <span>confirmed this week</span>
          </div>
          <div
            className="week-chart"
            role="img"
            aria-label={`Confirmed earnings by day: ${week.map((b) => `${b.label} ${centsToUsd(b.cents)}`).join(", ")}`}
          >
            {week.map((b, i) => (
              <div className={i === 6 ? "current-day" : ""} key={i}>
                <span className="bar-track">
                  <span
                    style={{ height: `${Math.max(3, (b.cents / weekMax) * 100)}%` }}
                    title={centsToUsd(b.cents)}
                  />
                </span>
                <span>{b.day}</span>
              </div>
            ))}
          </div>
          <p className="week-note">Every confirmed activity leaves a mark.</p>
        </section>
      </div>
    </>
  );
}
