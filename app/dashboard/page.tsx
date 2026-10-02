import Link from "next/link";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { centsToUsd } from "@/lib/money";
import { displayName, toFxTransaction, weekBuckets } from "@/lib/fx";
import { getSurveyWall } from "@/lib/providers";
import { Button } from "@/components/fx/primitives";
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
      <section className="money-rail" aria-label="Your balances">
        <div className="money-available">
          <span>Available balance</span>
          <strong>
            {centsToUsd(s.availableCents)} <small>USD</small>
          </strong>
        </div>
        <div>
          <span>Pending</span>
          <strong>{centsToUsd(s.pendingCents)}</strong>
          <small>Awaiting confirmation</small>
        </div>
        <div>
          <span>Lifetime earnings</span>
          <strong>{centsToUsd(s.lifetimeCents)}</strong>
          <small>Confirmed over time</small>
        </div>
        <div>
          <Button
            variant="secondary"
            disabled
            title="Withdrawals are not available yet"
          >
            {s.availableCents < 500 ? "Withdraw from $5.00" : "Withdraw rewards"}
          </Button>
          <Link href="/dashboard/wallet" className="money-history-link">
            See wallet &amp; history ↗
          </Link>
        </div>
      </section>
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
