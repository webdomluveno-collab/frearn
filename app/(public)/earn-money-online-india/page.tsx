import type { Metadata } from "next";
import Link from "next/link";
import { baseMetadata } from "@/lib/seo";
import { SectionHeading } from "@/components/fx/primitives";
import { PAYOUT_RULES } from "@/lib/withdrawals";
import { centsToUsd as money } from "@/lib/money";

export const metadata: Metadata = baseMetadata({
  title: "Earn Money Online in India with Paid Surveys",
  description:
    "Can you earn money online in India with paid surveys? How Freearn works, realistic expectations, low minimum withdrawals from $0.10, and what varies by eligibility and location.",
  alternates: { canonical: "/earn-money-online-india" },
});

const jsonLd = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Can I earn money online in India with paid surveys?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Paid surveys can pay small rewards, but availability, eligibility, and reward amounts vary by provider, location, profile, and device. There are no guaranteed earnings. Freearn shows each activity's requirements and estimated reward before you start, and only confirmed completions become withdrawable.",
      },
    },
    {
      "@type": "Question",
      name: "What is the minimum withdrawal on Freearn?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Revolut withdrawals start from $0.10. Selected native crypto withdrawals also start from $0.10. Litecoin, SOL, USDC, and Skrill start from $1.00. Every request is manually reviewed.",
      },
    },
  ],
};

export default function EarnMoneyOnlineIndiaPage() {
  return (
    <main id="india-main">
      <a className="skip-link" href="#india-main">
        Skip to content
      </a>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <div className="legal-page">
        <SectionHeading
          eyebrow="ONLINE EARNING, EXPLAINED HONESTLY"
          title="Earn money online in India with paid surveys"
          description="What survey rewards realistically look like, how Freearn works, and what to check before you start."
        />
        <section className="surface">
          <h2>How paid surveys work</h2>
          <p>
            Companies pay for opinions. Survey platforms pass part of that payment to you when
            you complete a survey that matches their audience. On Freearn you browse
            activities, check each reward and its requirements, and complete what fits
            your time. A provider must confirm completion before a reward becomes
            available in your balance.
          </p>
          <h2>Realistic expectations</h2>
          <p>
            Surveys pay small amounts, not a salary. What you see depends on your
            country, profile, device, and whether you qualify for a given survey —
            starting one does not guarantee completion or payment. Freearn cannot
            confirm that any specific offer is available in India at a given time;
            availability changes as providers open and close studies.
          </p>
          <ul>
            <li>Rewards are shown before you start — never assumed afterwards.</li>
            <li>Pending rewards stay separate until a provider confirms them.</li>
            <li>There is no guaranteed amount of earnings.</li>
          </ul>
          <h2>Cashing out: low minimum withdrawals</h2>
          <p>
            Freearn keeps withdrawal minimums small so a few confirmed rewards are
            enough for a first payout. Every request is manually reviewed.
          </p>
          <ul>
            <li>
              Revolut — from {money(PAYOUT_RULES.revolut.minimumCents)} (our fastest
              option)
            </li>
            <li>
              Native CFX, RVN, 0G, IOTX and XNO — from{" "}
              {money(PAYOUT_RULES.cfx.minimumCents)}
            </li>
            <li>
              Litecoin, SOL, USDC and Skrill — from {money(PAYOUT_RULES.sol.minimumCents)}{" "}
              (Skrill fees are deducted from the payout)
            </li>
          </ul>
          <p>
            Supported methods can differ by account and region — your wallet always
            shows what is actually available to you. Card payouts are coming soon.
          </p>
          <h2>Three steps to start</h2>
          <p>
            1. Create a free Freearn account. 2. Complete surveys or offers that
            fit your time and device. 3. Request a withdrawal once your confirmed
            balance reaches the minimum.
          </p>
          <h2>Reward levels and timing, honestly</h2>
          <p>
            A planned 50–85% loyalty system is still a design concept — it does not
            change rewards today. Most withdrawal requests are reviewed within
            approximately 1 hour; exceptional cases may take up to 3 days. Timing
            is a target, not a guarantee.
          </p>
          <p>
            Ready?{" "}
            <Link href="/register" className="text-link">
              Create a free account
            </Link>{" "}
            or read the <Link href="/faq" className="text-link">FAQ</Link> first.
            Back to the <Link href="/" className="text-link">homepage</Link>.
          </p>
        </section>
      </div>
    </main>
  );
}
