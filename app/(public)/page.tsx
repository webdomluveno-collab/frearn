import Link from "next/link";
import { Icon, Spark } from "@/components/fx/icon";
import { ButtonLink } from "@/components/fx/primitives";
import { OpportunityArt, type FxArt } from "@/components/fx/opportunity-art";

const categories: Array<{ art: FxArt; name: string; tagline: string }> = [
  {
    art: { art: "survey", accent: "lavender", category: "surveys", title: "surveys" },
    name: "Surveys",
    tagline: "A fresh perspective.",
  },
  {
    art: { art: "orbit", accent: "peach", category: "games", title: "games", wordmark: ["A LITTLE", "PLAYTIME"] },
    name: "Games",
    tagline: "A little playtime.",
  },
  {
    art: { art: "garden", accent: "green", category: "offers", title: "offers", wordmark: ["WORTH", "TRYING"] },
    name: "Offers",
    tagline: "Something worth trying.",
  },
  {
    art: { art: "task", accent: "blue", category: "tasks", title: "tasks" },
    name: "Tasks",
    tagline: "A satisfying small task.",
  },
];

export default function HomePage() {
  return (
    <div className="landing">
      <a className="skip-link" href="#home-main">
        Skip to content
      </a>
      <main id="home-main">
        <section className="landing-hero">
          <div className="landing-hero-copy">
            <span className="eyebrow">
              <span />
              YOUR EVERYDAY, REWARDED
            </span>
            <h1>
              Make a little
              <br />
              more of <br />
              your day<span>.</span>
            </h1>
            <p>
              Turn a few spare minutes into something for you. Take a survey, try a game, or find a
              task that fits.
            </p>
            <div className="landing-actions">
              <ButtonLink href="/register">Start earning</ButtonLink>
              <ButtonLink href="/login" variant="ghost">
                Take a look around
              </ButtonLink>
            </div>
            <span className="landing-reassurance">
              <Icon name="check" size={16} />
              Clear requirements. No promise of easy money.
            </span>
          </div>
          <div className="landing-brand-board">
            <span className="board-eyebrow">A LITTLE EFFORT. A LITTLE EXTRA.</span>
            <div className="board-rings" />
            <Spark size={260} className="board-spark" />
            <div className="board-type" aria-hidden="true">
              little
              <br />
              wins.
            </div>
            <div className="landing-receipt">
              <div>
                <span>Your little wins</span>
                <Spark size={20} />
              </div>
              <div className="receipt-row">
                <span>
                  <Icon name="survey" size={16} />
                  Surveys
                </span>
                <b>Matched to you</b>
              </div>
              <div className="receipt-row">
                <span>
                  <Icon name="gift" size={16} />
                  Offers &amp; games
                </span>
                <b>Tasks worth trying</b>
              </div>
              <span className="receipt-footnote">A preview of what adds up.</span>
            </div>
            <span className="board-footer">AT YOUR PACE. ON YOUR TERMS.</span>
          </div>
        </section>
        <section className="how-section" id="how-it-works">
          <div className="how-heading">
            <span className="eyebrow">NOT COMPLICATED. JUST CONSIDERED.</span>
            <h2>
              A good way to spend
              <br />a little spare time.
            </h2>
          </div>
          <div className="how-step">
            <span>01</span>
            <h3>Find your fit.</h3>
            <p>
              Browse surveys, games, offers, and tasks. See the estimated time and reward up front.
            </p>
          </div>
          <div className="how-step">
            <span>02</span>
            <h3>Know the details.</h3>
            <p>
              Check eligibility and requirements before you start. A reward follows confirmed
              completion.
            </p>
          </div>
          <div className="how-step">
            <span>03</span>
            <h3>Keep every win in view.</h3>
            <p>See what&apos;s available, what&apos;s pending, and the status of each withdrawal.</p>
          </div>
        </section>
        <section className="landing-opportunities">
          <div className="section-title">
            <div>
              <span className="eyebrow">THERE’S MORE THAN ONE WAY</span>
              <h2>What’s your kind of little win?</h2>
            </div>
            <ButtonLink href="/dashboard/earn" variant="secondary">
              Explore Earn
            </ButtonLink>
          </div>
          <div className="landing-category-grid">
            {categories.map((item) => (
              <Link href="/dashboard/earn" key={item.name} className="landing-category">
                <OpportunityArt opportunity={item.art} />
                <div>
                  <h3>{item.name}</h3>
                  <span>{item.tagline}</span>
                  <Icon name="plus" size={18} />
                </div>
              </Link>
            ))}
          </div>
          <p className="landing-sample-note">
            Illustrated categories. Availability, eligibility, and rewards vary.
          </p>
        </section>
        <section className="landing-closing">
          <div>
            <Spark size={34} />
            <h2>A little more for the things you love.</h2>
            <p>Start with something that fits your day.</p>
          </div>
          <ButtonLink href="/register" variant="lime">
            Find your first little win
          </ButtonLink>
        </section>
      </main>
    </div>
  );
}
