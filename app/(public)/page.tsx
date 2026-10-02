import Link from "next/link";
import { Icon } from "@/components/fx/icon";
import { ButtonLink } from "@/components/fx/primitives";
import { HistoryPath } from "@/components/fx/history-path";
import { StoryMotion } from "@/components/fx/story-motion";
import { StripArt, TallyMark } from "@/components/fx/tally";

const categories = [
  {
    name: "Surveys",
    detail: "Your point of view has a place here.",
    type: "surveys",
    annotation: "A FEW GOOD QUESTIONS",
  },
  {
    name: "Games",
    detail: "Try a game. Reach the stated milestones.",
    type: "games",
    annotation: "PLAY WITH A PURPOSE",
  },
  {
    name: "Tasks",
    detail: "A small job for a spare moment.",
    type: "tasks",
    annotation: "SMALL & SATISFYING",
  },
  {
    name: "Offers",
    detail: "Something new. Read the terms first.",
    type: "offers",
    annotation: "WORTH A CLOSER LOOK",
  },
];

export default function HomePage() {
  return (
    <StoryMotion>
      <div className="landing tally-landing">
        <a className="skip-link" href="#home-main">
          Skip to content
        </a>
        <main id="home-main">
          <section className="poster-hero">
            <div className="poster-index">
              <span>SPARE TIME. SOMETHING BACK.</span>
              <span>THE FREEARN WAY / 01</span>
            </div>
            <h1>
              <span>YOUR TIME</span>
              <span className="poster-second">
                ADDS <TallyMark size={175} /> UP.
              </span>
            </h1>
            <div className="poster-bottom">
              <span className="poster-annotation">
                A little, then
                <br />
                <em>a little more.</em>
                <svg viewBox="0 0 100 45" aria-hidden="true">
                  <path
                    d="M3 5c30 1 35 32 88 29m-13-12 14 12-16 8"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  />
                </svg>
              </span>
              <p>
                Turn spare minutes into rewards.
                <br />
                Take a survey. Try a game. Do a task.
                <br />
                <strong>Small actions. Something to show for them.</strong>
              </p>
              <div className="poster-actions">
                <ButtonLink href="/register">
                  Make your time count <Icon name="chevron" size={17} />
                </ButtonLink>
                <Link href="/dashboard/earn" className="text-link">
                  Explore earning options ↗
                </Link>
              </div>
            </div>
            <div className="poster-floor" aria-hidden="true">
              <span>01</span>
              {Array.from({ length: 27 }, (_, i) => (
                <i key={i} />
              ))}
              <span>+ ONE MORE</span>
            </div>
          </section>
          <section className="minutes-chapter" data-reveal>
            <span className="chapter-folio">01 / THE SMALL THINGS</span>
            <div className="minutes-equation">
              <span>
                A FEW
                <br />
                MINUTES.
              </span>
              <span className="equation-plus">+</span>
              <StripArt category="tasks" />
              <span>
                SOMETHING
                <br />
                BACK.
              </span>
            </div>
            <div className="minutes-note">
              <span>THERE’S NO MAGIC TRICK.</span>
              <p>
                Just activities with clear requirements and rewards for confirmed completion. Choose
                the ones that fit. Leave the rest.
              </p>
            </div>
          </section>
          <section className="assembly-chapter" id="how-it-works">
            <div className="assembly-sticky">
              <span className="chapter-folio">02 / WATCH IT ADD UP</span>
              <h2>
                ONE THING.
                <br />
                THEN ANOTHER.
              </h2>
              <div className="assembly-print" aria-hidden="true">
                <div className="activity-slip slip-one">
                  <span>01 / YOUR PERSPECTIVE</span>
                  <strong>A survey.</strong>
                  <span>Read the requirements →</span>
                </div>
                <div className="activity-slip slip-two">
                  <span>02 / A NEW CHALLENGE</span>
                  <strong>A game.</strong>
                  <span>Reach a milestone →</span>
                </div>
                <div className="activity-slip slip-three">
                  <span>03 / A SMALL JOB</span>
                  <strong>A task.</strong>
                  <span>Finish what you started →</span>
                </div>
                <div className="assembly-base">
                  <TallyMark size={76} />
                  <span>
                    SMALL ACTIONS.
                    <br />A GROWING HISTORY.
                  </span>
                </div>
              </div>
              <p className="sample-caption">
                Illustrative activities. Availability and rewards vary.
              </p>
            </div>
            <div className="assembly-narrative">
              <article data-reveal>
                <span>01 — FIND YOUR FIT</span>
                <h3>Start with the time you have.</h3>
                <p>
                  Five minutes or a longer break. Browse by category, estimated time and device.
                  Check the reward and conditions before you start.
                </p>
              </article>
              <article data-reveal>
                <span>02 — FINISH. GET CONFIRMED.</span>
                <h3>A completed activity is a step forward.</h3>
                <p>
                  Providers review completion. Keep the status in view while a reward is pending,
                  and see it move to available when confirmed.
                </p>
              </article>
              <article data-reveal>
                <span>03 — KEEP SOMETHING BACK</span>
                <h3>Clear money. Clear next steps.</h3>
                <p>
                  Available, pending and lifetime earnings stay separate. Choose an available
                  withdrawal method when you meet its requirements.
                </p>
                <Link href="/register" className="text-link">
                  Create your free account ↗
                </Link>
              </article>
            </div>
          </section>
          <section className="category-chapter" id="find-your-fit">
            <div className="category-intro">
              <span className="chapter-folio">03 / YOUR KIND OF TIME</span>
              <h2>
                WHAT FITS
                <br />
                <em>YOUR DAY?</em>
              </h2>
              <p>
                One place to find your next activity.
                <br />
                You choose the pace.
              </p>
            </div>
            <div className="category-editorial-list">
              {categories.map((item, i) => (
                <Link
                  href="/dashboard/earn"
                  className={`category-editorial category-${item.type}`}
                  key={item.type}
                >
                  <span className="category-serial">0{i + 1}</span>
                  <div>
                    <h3>{item.name}</h3>
                    <p>{item.detail}</p>
                  </div>
                  <StripArt category={item.type} />
                  <span className="category-annotation">{item.annotation}</span>
                  <span className="category-arrow" aria-hidden="true">
                    ↗
                  </span>
                </Link>
              ))}
            </div>
            <span className="sample-caption">
              Opportunities depend on provider availability and eligibility. No guaranteed earnings.
            </span>
          </section>
          <section className="history-chapter" data-reveal>
            <div className="history-chapter-title">
              <span className="chapter-folio">04 / A HISTORY WORTH BUILDING</span>
              <h2>
                BUILD HISTORY.
                <br />
                <em>KEEP MORE.</em>
              </h2>
              <p>
                We’re exploring a loyalty system that recognizes real, long-term participation. Your
                history could grow into a better reward share.
              </p>
              <span className="concept-label">FUTURE LOYALTY / NOT ACTIVE</span>
            </div>
            <HistoryPath publicView />
          </section>
          <section className="tally-closing">
            <span className="chapter-folio">YOUR NEXT SMALL THING</span>
            <h2>
              IT ALL STARTS
              <br />
              WITH <em>ONE.</em>
              <TallyMark size={190} />
            </h2>
            <div>
              <p>
                A few minutes.
                <br />
                Make them yours.
              </p>
              <ButtonLink href="/register" variant="lime">
                Find your first activity <Icon name="external" size={18} />
              </ButtonLink>
            </div>
          </section>
        </main>
      </div>
    </StoryMotion>
  );
}
