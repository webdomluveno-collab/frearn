import type { Metadata } from "next";
import Link from "next/link";
import { baseMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { centsToUsd } from "@/lib/money";
import { Icon } from "@/components/fx/icon";
import { TallyMark } from "@/components/fx/tally";
import {
  isActiveWithdrawalMethod,
  WITHDRAWAL_METHOD_META,
} from "@/lib/withdrawals";
import { HomepageMotion, PayoutSlider, PlannedLevels } from "@/components/homepage/experience";
import styles from "./homepage.module.css";

export const metadata: Metadata = baseMetadata({
  title: "Freearn — Turn spare moments into rewards",
  description:
    "Surveys, games and tasks in one place. Explore planned reward levels and request withdrawals from $3 with manual review.",
});

const minWithdraw = centsToUsd(siteConfig.minimumWithdrawalCents);

const steps = [
  {
    title: "Make yourself at home.",
    subtitle: "Join Freearn",
    detail: "One account. One place to find activities that fit your time.",
    icon: "home" as const,
  },
  {
    title: "Find your kind of activity.",
    subtitle: "Surveys, games & tasks",
    detail:
      "Check the reward, requirements and device before you begin. Providers confirm completion.",
    icon: "game" as const,
  },
  {
    title: "Keep something back.",
    subtitle: "Build your balance",
    detail: `Confirmed rewards build your available balance. Request a withdrawal from ${minWithdraw}.`,
    icon: "wallet" as const,
  },
];

const METHOD_SYMBOLS: Record<string, string> = {
  paypal: "P",
  skrill: "S",
  revolut: "@",
  sol: "◎",
  usdc_solana: "$",
};

const methods: Array<{ name: string; state: "active" | "soon"; note: string; symbol: string }> = [
  ...siteConfig.liveWithdrawalMethods.filter(isActiveWithdrawalMethod).map((id) => ({
    name: WITHDRAWAL_METHOD_META[id].label,
    state: "active" as const,
    note:
      id === "paypal"
        ? "To your PayPal email"
        : id === "skrill"
          ? "To your Skrill email"
          : id === "revolut"
            ? "To your Revolut @username"
            : "Solana network",
    symbol: METHOD_SYMBOLS[id] ?? "•",
  })),
  { name: "Card", state: "soon", note: "No card provider integrated yet", symbol: "▭" },
];

const faqs: Array<[string, string]> = [
  [
    "What is Freearn?",
    "Freearn is one place to find surveys, games and tasks, see their requirements, and track rewards for confirmed completion in a single wallet.",
  ],
  [
    "How do rewards work?",
    "Each activity states its requirements and an estimated reward. A provider must confirm completion before a reward becomes available. Pending rewards are separate from your available balance.",
  ],
  [
    "Why do reward amounts vary?",
    "Providers set different rewards and conditions. Time, milestones, eligibility, device and location can all affect the activities you see. There is no guaranteed amount of earnings.",
  ],
  [
    "What is the 50–85% system?",
    "It is a planned loyalty system, currently in development. The idea is to start around a 50% share and potentially keep up to 85% of a provider reward as you build legitimate activity and history. Shares, eligibility and level requirements are not final. These levels cannot be unlocked today.",
  ],
  [
    "How do withdrawals work?",
    `Request a withdrawal from ${minWithdraw}. PayPal, Skrill, Revolut, SOL and USDC on Solana are active; card payouts are coming soon. Every request is manually reviewed at launch — most are reviewed within 1 hour, with up to 3 days in exceptional cases. Requested funds are reserved from your available balance immediately and returned if a request is rejected.`,
  ],
  [
    "How fast are withdrawals processed?",
    "The target is to review most withdrawals within 1 hour, with up to 3 days in exceptional cases. These are processing targets, not guarantees. Automation may be added later.",
  ],
  [
    "Can I use Freearn anywhere?",
    "The web experience is designed for phones and laptops. You can browse when you have free time, but opportunities vary by provider, location, eligibility and device. Some activities need a specific device or connection.",
  ],
  [
    "Why might a survey disappear or disqualify me?",
    "A survey can fill its quota, close, or find that your answers do not match its audience. Providers decide qualification and completion. Review the conditions first; a reward is not guaranteed for every survey you start.",
  ],
];

export default function HomePage() {
  return (
    <HomepageMotion>
      <a className={styles.skip} href="#home-main">
        Skip to content
      </a>
      <main id="home-main">
        <section className={`${styles.hero} ${styles.container}`} aria-labelledby="hero-title">
          <div className={styles.heroCopy}>
            <span className={styles.eyebrow}>
              <i /> A LITTLE TIME. A LITTLE POSSIBILITY.
            </span>
            <h1 id="hero-title">
              Your spare time.
              <br />
              <span>Something back.</span>
            </h1>
            <p>Surveys, games and tasks. One place to turn the moments in between into rewards.</p>
            <div className={styles.heroActions}>
              <Link href="/register" className={styles.cta}>
                Start with Freearn <span aria-hidden="true">↗</span>
              </Link>
              <a href="#payout-preview" className={styles.inlineLink}>
                See how your share could grow <span aria-hidden="true">↓</span>
              </a>
            </div>
            <div className={styles.heroTrust}>
              <Icon name="check" size={18} />
              <span>You choose the activity. You set the pace.</span>
            </div>
            <p className={styles.heroFuture}>
              Planned reward levels: <strong>50% → 85%</strong>.<br />
              Withdraw from {minWithdraw} with manual review.
            </p>
          </div>
          <div
            className={styles.heroVisual}
            role="img"
            aria-label="Planned loyalty illustration: from 50 percent to up to 85 percent. Not active yet."
          >
            <div className={styles.visualTop}>
              <span>THE SMALL MOMENTS ADD UP</span>
              <span aria-hidden="true">↗</span>
            </div>
            <div className={styles.visualOrbit} aria-hidden="true">
              <i />
              <i />
              <i />
            </div>
            <div className={styles.heroActivity}>
              <Icon name="survey" size={22} />
              <span>A few questions.</span>
              <span aria-hidden="true">↗</span>
            </div>
            <div className={styles.heroTarget}>
              <span>UP TO</span>
              <strong>
                85<span>%</span>
              </strong>
              <span>PLANNED REWARD SHARE</span>
            </div>
            <div className={styles.heroPath} aria-hidden="true">
              <span>50%</span>
              <i />
              <i />
              <i />
              <i />
              <i />
              <span>85%</span>
            </div>
            <div className={styles.visualFoot}>
              <span className={styles.plannedTag}>LOYALTY IN DEVELOPMENT</span>
              <span>
                A bigger share.
                <br />A longer history.
              </span>
            </div>
          </div>
          <div className={styles.heroFoot}>
            <span>01 / MAKE YOUR MOMENTS COUNT</span>
            <span>
              <Icon name="mobile" size={17} /> PHONE OR LAPTOP
            </span>
          </div>
        </section>
        <section
          id="payout-preview"
          className={`${styles.calculatorSection} ${styles.container}`}
          aria-labelledby="payout-title"
          data-reveal
        >
          <div className={styles.sectionIntro}>
            <span className={styles.eyebrow}>02 / TRY THE POSSIBILITIES</span>
            <h2 id="payout-title">
              Same activity.
              <br />
              <span>A bigger share.</span>
            </h2>
            <p>
              A higher reward level would mean keeping more of the provider reward. Move the slider.
              See the idea in action.
            </p>
            <span className={styles.plannedTag}>PLANNED LEVELS · NOT ACTIVE</span>
          </div>
          <PayoutSlider />
        </section>
        <section
          id="how-it-works"
          className={`${styles.howSection} ${styles.container}`}
          aria-labelledby="how-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>03 / A SIMPLE START</span>
              <h2 id="how-title">
                Less figuring it out.
                <br />
                More getting into it.
              </h2>
            </div>
            <p>
              Three steps. Clear requirements.
              <br />
              You always know what comes next.
            </p>
          </div>
          <div className={styles.steps}>
            {steps.map((step, i) => (
              <article key={step.title} className={styles.step} data-reveal>
                <div className={styles.stepTop}>
                  <span>0{i + 1}</span>
                  <Icon name={step.icon} size={29} />
                </div>
                <span className={styles.stepSubtitle}>{step.subtitle}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
          <div className={styles.howNote}>
            <Icon name="check" size={18} />
            <p>
              No shortcuts or guaranteed earnings. Just clear activities and rewards for confirmed
              completion.
            </p>
          </div>
        </section>
        <section id="reward-levels" className={styles.levelSection} aria-labelledby="levels-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>04 / A HISTORY WORTH BUILDING</span>
                <h2 id="levels-title">
                  Keep coming back.
                  <br />
                  <span>Keep a little more.</span>
                </h2>
              </div>
              <div>
                <span className={styles.plannedTag}>LOYALTY SYSTEM IN DEVELOPMENT</span>
                <p>
                  We’re designing levels that could recognize genuine activity over time. From a
                  proposed 50% starting share to potentially 85%.
                </p>
              </div>
            </div>
            <PlannedLevels />
            <div className={styles.levelPrinciples}>
              <span>
                <Icon name="check" size={17} /> Confirmed activities
              </span>
              <span>
                <Icon name="clock" size={17} /> History over time
              </span>
              <span>
                <Icon name="home" size={17} /> One ongoing account
              </span>
            </div>
            <p className={styles.disclaimer}>
              Future concept. Shares, criteria and thresholds are not final. No level changes your
              rewards today, and 85% cannot be unlocked yet.
            </p>
          </div>
        </section>
        <section
          id="withdrawals"
          className={`${styles.withdrawalSection} ${styles.container}`}
          aria-labelledby="withdrawal-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>05 / SOMETHING YOU CAN KEEP</span>
              <h2 id="withdrawal-title">
                Your rewards.
                <br />
                Your way out.
              </h2>
            </div>
            <div>
              <p>
                Request a withdrawal from {minWithdraw}. Every request is manually reviewed at
                launch — most are reviewed within 1 hour, with up to 3 days in exceptional cases.
              </p>
            </div>
          </div>
          <div className={styles.paymentMethods}>
            {methods.map((method) => (
              <article className={styles.paymentMethod} key={method.name}>
                <div className={styles.paymentSymbol} aria-hidden="true">
                  {method.symbol}
                </div>
                <h3>{method.name}</h3>
                <p>{method.note}</p>
                <span>{method.state === "active" ? "ACTIVE" : "SOON"}</span>
              </article>
            ))}
          </div>
          <div className={styles.withdrawalPlan}>
            <div className={styles.reviewIntro}>
              <Icon name="clock" size={24} />
              <h3>
                Clear timing.
                <br />
                Human review.
              </h3>
            </div>
            <div>
              <strong>Within 1 hour</strong>
              <span>Target for most reviews</span>
            </div>
            <div>
              <strong>Up to 3 days</strong>
              <span>In exceptional cases</span>
            </div>
            <p>
              Manual review at launch, with automation intended later. These are
              processing targets, not guaranteed times. Reserved funds return to your balance if a
              request is rejected.
            </p>
          </div>
        </section>
        <section
          id="earn-anywhere"
          className={styles.anywhereSection}
          aria-labelledby="anywhere-title"
        >
          <div className={styles.container}>
            <div className={styles.anywhereHeading}>
              <span className={styles.eyebrow}>06 / LIFE HAS LITTLE GAPS</span>
              <h2 id="anywhere-title">
                A sofa. A seat.
                <br />
                <span>A spare moment.</span>
              </h2>
              <p>
                Your free time can become reward time.
                <br />
                On a phone or a laptop, at your own pace.
              </p>
            </div>
            <div className={styles.scenes}>
              <article className={`${styles.scene} ${styles.homeScene}`} data-reveal>
                <span className={styles.sceneLabel}>01 / AT HOME</span>
                <div className={styles.roomArt} aria-hidden="true">
                  <div className={styles.windowArt}>
                    <i />
                    <i />
                  </div>
                  <div className={styles.lampArt} />
                  <div className={styles.sofaArt}>
                    <i />
                    <i />
                  </div>
                  <div className={styles.laptopArt}>
                    <TallyMark size={38} />
                  </div>
                </div>
                <h3>A little room in your day.</h3>
                <p>Between the things on your list.</p>
              </article>
              <article className={`${styles.scene} ${styles.trainScene}`} data-reveal>
                <span className={styles.sceneLabel}>02 / ON THE MOVE</span>
                <div className={styles.trainArt} aria-hidden="true">
                  <div className={styles.trainWindow}>
                    <i />
                    <i />
                    <i />
                    <span />
                  </div>
                  <div className={styles.phoneArt}>
                    <Icon name="survey" size={24} />
                    <i />
                    <i />
                    <span>YOUR TIME.</span>
                  </div>
                </div>
                <h3>Make the in-between yours.</h3>
                <p>A train seat. A break along the way.</p>
              </article>
              <article className={`${styles.scene} ${styles.travelScene}`} data-reveal>
                <span className={styles.sceneLabel}>03 / A CHANGE OF SCENE</span>
                <div className={styles.travelArt} aria-hidden="true">
                  <div className={styles.sunArt} />
                  <div className={styles.horizonArt}>
                    <i />
                    <i />
                  </div>
                  <div className={styles.ticketArt}>
                    <span>FREE TIME</span>
                    <TallyMark size={35} />
                    <i />
                  </div>
                </div>
                <h3>Wherever your day takes you.</h3>
                <p>Browse when the moment fits.</p>
              </article>
            </div>
            <p className={styles.disclaimer}>
              Availability depends on provider, location, eligibility and device. Some activities
              need a specific device or connection. Rewards are never guaranteed everywhere.
            </p>
          </div>
        </section>
        <section
          id="questions"
          className={`${styles.faqSection} ${styles.container}`}
          aria-labelledby="faq-title"
        >
          <div className={styles.faqIntro}>
            <span className={styles.eyebrow}>07 / GOOD QUESTIONS</span>
            <h2 id="faq-title">
              A little clarity
              <br />
              goes a long way.
            </h2>
            <p>
              Know what’s here.
              <br />
              Know what’s coming.
            </p>
            <Link href="/faq" className={styles.inlineLink}>
              More help <span aria-hidden="true">↗</span>
            </Link>
          </div>
          <div className={styles.faqList}>
            {faqs.map(([question, answer]) => (
              <details key={question}>
                <summary>
                  {question}
                  <span aria-hidden="true">+</span>
                </summary>
                <p>{answer}</p>
              </details>
            ))}
          </div>
          <div className={styles.finalCta} data-reveal>
            <div>
              <span className={styles.eyebrow}>START SMALL. SEE WHAT FITS.</span>
              <h2>
                Your next spare moment.
                <br />
                <span>Make it yours.</span>
              </h2>
            </div>
            <div>
              <Link href="/register" className={`${styles.cta} ${styles.ctaLight}`}>
                Explore Freearn
              </Link>
              <Link href="/login">
                Already here? Log in <span aria-hidden="true">↗</span>
              </Link>
              <p>Real rewards. Manual withdrawal review at launch.</p>
            </div>
          </div>
        </section>
      </main>
    </HomepageMotion>
  );
}
