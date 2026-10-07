import { PAYOUT_RULES } from "@/lib/withdrawals";
import { centsToUsd } from "@/lib/money";
import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { SectionHeading } from "@/components/fx/primitives";

// TODO(legal): placeholder terms — MUST be reviewed by counsel before production.

export const metadata: Metadata = baseMetadata({ title: "Terms of Service" });

export default function TermsPage() {
  const sections = [
    ["Eligibility", "You must be of legal age in your country and able to form a binding agreement."],
    ["One account per person", "Only one account per individual. Duplicate accounts may be suspended."],
    ["Truthful information", "Provide accurate profile and account information. False data may void rewards."],
    ["Prohibited fraud / automation", "No bots, scripts, falsified completions, or manipulation of tracking. Violations lead to suspension and reversals."],
    ["VPN / proxy abuse", "Misrepresenting your location (e.g. via VPN/proxy) to access unavailable opportunities is prohibited."],
    ["Rewards", "Rewards are promotional credits, not wages. Amounts, availability, and qualification vary. Starting a survey does not guarantee completion or reward."],
    ["Reversals / chargebacks", "Rewards may be reversed for fraud, provider clawbacks, duplicate crediting, or invalid completions."],
    ["Withdrawals", `Withdrawal minimums depend on the method: ${centsToUsd(PAYOUT_RULES.revolut.minimumCents)} for Revolut; ${centsToUsd(PAYOUT_RULES.sol.minimumCents)} for Litecoin, SOL, USDC on Solana or USDC on BNB Smart Chain (BEP20). New PayPal and Skrill requests are disabled; historical withdrawals remain accessible. Card payouts are coming soon. Withdrawals require manual review. Methods vary by country. Requested funds are reserved immediately and returned if a request is rejected. One active withdrawal request per account is allowed at a time.`],
    ["Account suspension", "We may suspend accounts for violations, abuse, or risk, with transaction history retained for review."],
    ["Third-party opportunities", "Opportunities may be provided by third parties subject to their own terms. We are not responsible for third-party content, qualification decisions, or availability."],
    ["Limitation of liability", "To the maximum extent permitted by law, the service is provided 'as is' without warranties. Liability is limited as permitted by applicable law."],
    ["Changes to the service", "Features, rewards, and terms may change. Material changes will be communicated."],
  ];
  return (
    <main id="terms-main">
      <a className="skip-link" href="#terms-main">Skip to content</a>
      <div className="legal-page">
        <SectionHeading
          eyebrow="THE FINE PRINT, PLAINLY"
          title="Terms of Service"
          description="Last updated: 2026-01-01 · Placeholder — pending legal review."
        />
        <div className="surface">
          {sections.map(([t, b]) => (
            <section key={t}>
              <h2>{t}</h2>
              <p>{b}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  );
}
