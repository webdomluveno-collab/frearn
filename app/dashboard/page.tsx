import Link from "next/link";
import { getSessionUser } from "@/lib/auth/server";
import { getMyLedger } from "@/lib/db/wallet";
import { summarizeLedger } from "@/lib/wallet/ledger";
import { centsToUsd } from "@/lib/money";
import { displayName, toFxTransaction, weekBuckets } from "@/lib/fx";
import { getSurveyWall } from "@/lib/providers";
import { ButtonLink, SectionHeading } from "@/components/fx/primitives";
import { Icon, Spark } from "@/components/fx/icon";
import { OpportunityArt } from "@/components/fx/opportunity-art";
import { TransactionList } from "@/components/fx/transactions";

function todayLabel(now = new Date()): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(now);
}

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
      <SectionHeading
        eyebrow="YOUR EVERYDAY, REWARDED"
        title={fresh ? `Welcome, ${name}. Start with a little win.` : `Hey ${name}. Good things add up.`}
        description={
          fresh
            ? "A few spare minutes. A good place to begin."
            : "A little time for you. A little more in your pocket."
        }
      >
        <span className="today-label">
          <Icon name="sun" size={17} />
          {todayLabel()}
        </span>
      </SectionHeading>
      <div className="overview-top">
        <section className="brand-feature">
          <div className="brand-feature-content">
            <span className="eyebrow">MAKE YOUR SPARE TIME COUNT</span>
            <h2>
              Your time.
              <br />
              Well rewarded<span>.</span>
            </h2>
            <p>
              Something quick. Something fun.
              <br />
              Find a little win that fits your day.
            </p>
            <ButtonLink href="/dashboard/earn" variant="lime">
              Find your next opportunity
            </ButtonLink>
          </div>
          <div className="brand-feature-art" aria-hidden="true">
            <div className="feature-orbit" />
            <Spark size={180} />
            <span className="feature-art-caption">
              LITTLE WINS.
              <br />
              REAL MOMENTUM.
            </span>
            <span className="feature-cross">+</span>
          </div>
        </section>
        <section className="balance-feature" aria-label="Balance summary">
          <div className="balance-feature-label">
            <span>Available balance</span>
            <Icon name="wallet" size={19} />
          </div>
          <div className="balance-amount">
            {centsToUsd(s.availableCents)}
            <span>USD</span>
          </div>
          <p className="balance-caption">Yours, and ready when you are.</p>
          <div className="balance-secondary">
            <div>
              <span>
                Pending{" "}
                <span className="info-dot" title="Awaiting provider review">
                  i
                </span>
              </span>
              <strong>{centsToUsd(s.pendingCents)}</strong>
            </div>
            <div>
              <span>Lifetime earned</span>
              <strong>{centsToUsd(s.lifetimeCents)}</strong>
            </div>
          </div>
          <ButtonLink
            href="/dashboard/wallet"
            variant="secondary"
            className="full-width"
            aria-disabled="true"
            title="Withdrawals are not available yet"
          >
            {s.availableCents < 500 ? "Withdraw from $5.00" : "Withdraw rewards"}
          </ButtonLink>
          <p className="small muted">Withdrawals aren&apos;t available yet.</p>
        </section>
      </div>
      <section className="opportunity-section">
        <div className="section-title">
          <div>
            <h2>Picked for your pace</h2>
            <p>A few good places to start.</p>
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
            <h2>Every little win, in view</h2>
            <Link href="/dashboard/transactions" className="text-link">
              See all
            </Link>
          </div>
          {fresh ? (
            <div className="new-activity">
              <Icon name="activity" size={25} />
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
            <h2>A good little week</h2>
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
          <p className="week-note">At your own pace. Every bit counts.</p>
        </section>
      </div>
    </>
  );
}
