import type { Metadata } from 'next';
import Link from 'next/link';
import { Icon, type IconName } from '@/components/fx/icon';
import { TallyMark } from '@/components/fx/tally';
import { MomentArt } from '@/components/fx/moment-art';
import { HomepageMotion, PayoutSlider, PlannedLevels } from '@/components/homepage/experience';
import { PAYOUT_RULES } from '@/lib/withdrawals';
import { centsToUsd as money } from '@/lib/money';
import styles from './homepage.module.css';

export const metadata: Metadata = {
  title: 'Freearn — Little moments. Real possibilities.',
  description: `Discover surveys and offers. Cash out from just ${money(PAYOUT_RULES.revolut.minimumCents)} with Revolut or PayPal. Crypto withdrawals from ${money(PAYOUT_RULES.sol.minimumCents)}.`,
};
const minimum = money(PAYOUT_RULES.revolut.minimumCents);
const cryptoMinimum = money(PAYOUT_RULES.sol.minimumCents);
const steps: { title: string; detail: string; icon: IconName; label: string }[] = [
  {
    title: 'Make yourself at home.',
    label: 'JOIN FREEARN',
    detail: 'Create an account and find activities that fit your time.',
    icon: 'home',
  },
  {
    title: 'Find your little win.',
    label: 'SURVEYS & OFFERS',
    detail:
      'Check the reward and requirements. Providers verify completion before a reward is confirmed.',
    icon: 'survey',
  },
  {
    title: 'Start small. Cash out.',
    label: `FROM ${minimum}`,
    detail:
      `Revolut or PayPal from ${minimum}; crypto from ${cryptoMinimum}. Only confirmed, available rewards can be withdrawn.`,
    icon: 'wallet',
  },
  {
    title: 'A human checks. You get paid.',
    label: 'REVIEW, THEN PAYOUT',
    detail: 'Requests are manually reviewed. Revolut is our fastest payout option.',
    icon: 'check',
  },
];
const faqs = [
  [
    'What is the minimum withdrawal?',
    `Cash out from just ${minimum} with Revolut or PayPal. Crypto withdrawals from ${cryptoMinimum}. Only confirmed, available rewards can be withdrawn. One active withdrawal request per account is allowed at a time.`,
  ],
  [
    'How fast are payouts processed?',
    'Revolut is our fastest payout option. Most requests are reviewed within approximately 1 hour; exceptional cases may take up to 3 days. These are estimates, not guaranteed payout times.',
  ],
  [
    'Which payout methods can I choose?',
    'Revolut / Revtag, PayPal, Litecoin, SOL on Solana, USDC on Solana and USDC on BNB Smart Chain (BEP20) are supported. Skrill is available only for historical withdrawals. Revolut is our fastest payout option. Card payouts are coming soon. Check your wallet for availability.',
  ],
  [
    'Do I need to pay anything?',
    'Creating an account is free. Read each offer’s conditions before starting: some offers may require a purchase or subscription. You choose which activities to take, and can stick to activities without a purchase requirement.',
  ],
  [
    'Can I use my phone?',
    'Yes, the experience is designed for phones and desktops. Some activities require a particular device, location or connection. Check the requirements before starting, whether you are at home, on a train or travelling.',
  ],
  [
    'Why do rewards vary?',
    'Providers set the rewards and conditions. Eligibility, location, device, survey length and offer milestones can all affect what you see. Completion must be confirmed; there is no guaranteed amount of earnings.',
  ],
  [
    'Are the 50–85% reward levels active?',
    'No. These are planned loyalty concepts. Shares, requirements and eligibility are still being designed. The calculator is an illustration, and no level changes your actual rewards or balance today.',
  ],
];
function HomeBrand() {
  return (
    <Link href="/" className={styles.brand} aria-label="Freearn home">
      <TallyMark size={31} />
      <span>
        freearn<span className={styles.brandDot}>.</span>
      </span>
    </Link>
  );
}
function JoinLink({
  children = 'Get started — it’s free',
  light = false,
}: {
  children?: React.ReactNode;
  light?: boolean;
}) {
  return (
    <Link href="/register" className={`${styles.cta} ${light ? styles.ctaLight : ''}`}>
      {children}
      <span aria-hidden="true">↗</span>
    </Link>
  );
}
export default function HomePage() {
  return (
    <HomepageMotion>
      <a className={styles.skip} href="#home-main">
        Skip to content
      </a>
      <header className={`${styles.header} ${styles.container}`}>
        <HomeBrand />
        <nav aria-label="Public navigation">
          <a href="#how-it-works">How it works</a>
          <a href="#withdrawals">Payouts</a>
          <a href="#questions">Questions</a>
        </nav>
        <div className={styles.headerActions}>
          <Link href="/login">Log in</Link>
          <JoinLink>Get started</JoinLink>
        </div>
      </header>
      <main id="home-main">
        <section className={styles.hero} aria-labelledby="hero-title">
          <div className={`${styles.heroInner} ${styles.container}`}>
            <div className={styles.heroCopy}>
              <span className={styles.eyebrow}>
                <i /> LITTLE MOMENTS. REAL POSSIBILITIES.
              </span>
              <h1 id="hero-title">
                A little time.
                <br />A little <span>more.</span>
                <svg viewBox="0 0 300 30" aria-hidden="true">
                  <path d="M4 19Q135 1 295 15M10 27Q135 14 260 23" />
                </svg>
              </h1>
              <p>
                Turn your in-between moments into rewards.
                <br />
                Discover surveys and offers. Choose what fits your day.
              </p>
              <div className={styles.heroBenefits}>
                <span>
                  <Icon name="wallet" size={19} />
                  <strong>Cash out from just {minimum} with Revolut or PayPal.</strong>
                </span>
                <span>
                  <Icon name="clock" size={19} />
                  Our fastest option: <strong>Revolut</strong>
                </span>
              </div>
              <div className={styles.heroActions}>
                <JoinLink />
                <a href="#how-it-works" className={styles.inlineLink}>
                  Take a look <span aria-hidden="true">↓</span>
                </a>
              </div>
              <p className={styles.heroNote}>
                Crypto withdrawals from {cryptoMinimum}. Manual review before payout.
              </p>
            </div>
            <div className={styles.heroVisual}>
              <MomentArt />
            </div>
          </div>
          <div className={`${styles.heroFoot} ${styles.container}`}>
            <span>MAKE YOUR MOMENTS COUNT</span>
            <span>
              <Icon name="mobile" size={16} /> PHONE OR DESKTOP <span aria-hidden="true">↗</span>
            </span>
          </div>
        </section>
        <section
          id="fast-payouts"
          className={`${styles.fastSection} ${styles.container}`}
          aria-labelledby="fast-title"
        >
          <div className={styles.fastIntro}>
            <span className={styles.eyebrow}>02 / SMALL MINIMUM. QUICK NEXT STEP.</span>
            <h2 id="fast-title">
              Little wins.
              <br />
              <span>Less waiting.</span>
            </h2>
            <p>
              Cash out from just {minimum} with Revolut or PayPal. Crypto withdrawals from {cryptoMinimum}.
              Revolut is our fastest option, with a human check first.
            </p>
            <span className={styles.reviewTag}>
              <Icon name="check" size={16} /> Fast manual withdrawals
            </span>
          </div>
          <div className={styles.fastVisual}>
            <div className={styles.payoutTicket}>
              <span>THE MINIMUM, MADE SMALL</span>
              <strong>
                {minimum}
                <span>USD</span>
              </strong>
              <p>No big balance needed to take the next step.</p>
              <div>
                <b>Revolut</b>
                <span>+</span>
                <b>PayPal</b>
                <span aria-hidden="true">↗</span>
              </div>
            </div>
            <ol className={styles.payoutFlow}>
              <li>
                <span>01</span>Request
              </li>
              <li>
                <span>02</span>Manual review
              </li>
              <li>
                <span>03</span>Payout
              </li>
            </ol>
            <p className={styles.smallNote}>
              Review first, then payment. Processing time can vary.
            </p>
          </div>
        </section>
        <section
          id="payout-preview"
          className={styles.calculatorSection}
          aria-labelledby="payout-title"
        >
          <div className={`${styles.calculatorInner} ${styles.container}`}>
            <div className={styles.sectionIntro}>
              <span className={styles.eyebrow}>03 / GIVE THE IDEA A SPIN</span>
              <h2 id="payout-title">
                A small activity.
                <br />
                <span>A share that grows.</span>
              </h2>
              <p>
                What could future reward levels look like? Try a share of the same $1.48 provider
                reward and see the difference.
              </p>
              <span className={styles.plannedTag}>PLANNED LOYALTY · NOT ACTIVE</span>
              <div className={styles.exampleDoodle} aria-hidden="true">
                <TallyMark size={85} />
                <span>
                  SAME ACTIVITY.
                  <br />
                  MORE POSSIBILITY. ↗
                </span>
              </div>
            </div>
            <PayoutSlider />
          </div>
        </section>
        <section
          id="how-it-works"
          className={`${styles.howSection} ${styles.container}`}
          aria-labelledby="how-title"
        >
          <div className={styles.sectionHeading}>
            <div>
              <span className={styles.eyebrow}>04 / FIND YOUR RHYTHM</span>
              <h2 id="how-title">
                From “got a minute?”
                <br />
                to <span>“that adds up.”</span>
              </h2>
            </div>
            <p>
              A few clear steps.
              <br />
              You always know what comes next.
            </p>
          </div>
          <div className={styles.steps}>
            {steps.map((step, i) => (
              <article key={step.label} className={styles.step} data-reveal>
                <div className={styles.stepTop}>
                  <span>0{i + 1}</span>
                  <Icon name={step.icon} size={25} />
                </div>
                <span className={styles.stepSubtitle}>{step.label}</span>
                <h3>{step.title}</h3>
                <p>{step.detail}</p>
              </article>
            ))}
          </div>
          <p className={styles.howNote}>
            <Icon name="check" size={18} />
            Confirmed rewards count. Pending rewards wait for provider verification.
          </p>
        </section>
        <section id="reward-levels" className={styles.levelSection} aria-labelledby="levels-title">
          <div className={styles.container}>
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>05 / SOMETHING TO GROW INTO</span>
                <h2 id="levels-title">
                  Little by little.
                  <br />
                  <span>Level by level.</span>
                </h2>
              </div>
              <div>
                <span className={styles.plannedTag}>IN DEVELOPMENT</span>
                <p>
                  We’re exploring ways to recognise genuine activity over time. A proposed 50%
                  starting share, up to a potential 85%.
                </p>
              </div>
            </div>
            <PlannedLevels />
            <p className={styles.disclaimer}>
              Future concept. Shares, criteria and thresholds are not final. Levels do not change
              actual rewards or your balance, and 85% cannot be unlocked today.
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
              <span className={styles.eyebrow}>06 / YOUR REWARDS. YOUR NEXT MOVE.</span>
              <h2 id="withdrawal-title">
                Small minimum.
                <br />
                <span>Familiar wallets.</span>
              </h2>
            </div>
            <p>
              Revolut and PayPal. A small start.
              <br />
              Revolut is our fastest option. Manual approval for every request.
            </p>
          </div>
          <div className={styles.paymentMethods}>
            <article className={`${styles.paymentMethod} ${styles.revolut}`}>
              <span className={styles.methodTag}>PRIMARY / FASTEST</span>
              <div className={styles.paymentSymbol} aria-hidden="true">
                R
              </div>
              <h3>Revolut</h3>
              <p>Fast manual payouts to your wallet.</p>
              <div>
                <span>From {minimum}</span>
                <Icon name="external" size={20} />
              </div>
            </article>
            <article className={`${styles.paymentMethod} ${styles.paypal}`}>
              <span className={styles.methodTag}>SMALL START</span>
              <div className={styles.paymentSymbol} aria-hidden="true">
                P
              </div>
              <h3>PayPal</h3>
              <p>Manual payments to your PayPal account.</p>
              <div>
                <span>From {minimum}</span>
                <Icon name="external" size={20} />
              </div>
            </article>
            <article className={`${styles.paymentMethod} ${styles.card}`}>
              <span className={styles.methodTag}>COMING SOON</span>
              <div className={styles.paymentSymbol} aria-hidden="true">
                <Icon name="wallet" size={37} />
              </div>
              <h3>Card payouts</h3>
              <p>Another way out is on the horizon.</p>
              <div>
                <span>Not available yet</span>
                <Icon name="clock" size={20} />
              </div>
            </article>
          </div>
          <p className={styles.disclaimer}>
            Availability depends on account and region. Check your wallet for supported methods.
            Crypto withdrawals from {cryptoMinimum}: Litecoin, SOL on Solana, USDC on Solana and USDC on BNB Smart Chain (BEP20). Most requests are reviewed within approximately 1 hour; exceptional cases may take up to 3 days. Timing is not guaranteed.
          </p>
        </section>
        <section
          id="earn-anywhere"
          className={styles.anywhereSection}
          aria-labelledby="anywhere-title"
        >
          <div className={styles.container}>
            <div className={styles.anywhereHeading}>
              <span className={styles.eyebrow}>07 / LIFE HAS LITTLE GAPS</span>
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
            <span className={styles.eyebrow}>08 / GOOD QUESTIONS</span>
            <h2 id="faq-title">
              Before your
              <br />
              <span>first little win.</span>
            </h2>
            <p>A few things worth knowing.</p>
            <Link href="/contact" className={styles.inlineLink}>
              More help <span aria-hidden="true">↗</span>
            </Link>
            <div className={styles.questionDoodle} aria-hidden="true">
              ?
            </div>
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
        </section>
        <section className={styles.closingSection} aria-labelledby="closing-title">
          <div className={`${styles.finalCta} ${styles.container}`}>
            <div>
              <span className={styles.eyebrow}>09 / YOUR NEXT SPARE MOMENT</span>
              <h2 id="closing-title">
                A little time.
                <br />
                <span>Make it yours.</span>
              </h2>
              <p>Surveys. Offers. A small start that fits your day.</p>
            </div>
            <div>
              <span className={styles.closingDoodle} aria-hidden="true">
                ↗
              </span>
              <JoinLink light>Start with Freearn</JoinLink>
              <Link href="/login">Already here? Log in ↗</Link>
              <p>Free to join. Rewards depend on eligibility and confirmed completion.</p>
            </div>
          </div>
        </section>
      </main>
      <footer className={`${styles.footer} ${styles.container}`}>
        <HomeBrand />
        <span>© 2026 Freearn · A little, then a little more.</span>
        <div>
          <Link href="/contact">Help & support</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
        </div>
      </footer>
    </HomepageMotion>
  );
}
