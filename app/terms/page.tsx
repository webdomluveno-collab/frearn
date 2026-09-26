import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";

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
    ["Withdrawals", "Withdrawals require meeting the minimum threshold and verification. Methods vary by country and are unavailable during pre-launch."],
    ["Account suspension", "We may suspend accounts for violations, abuse, or risk, with transaction history retained for review."],
    ["Third-party opportunities", "Opportunities may be provided by third parties subject to their own terms. We are not responsible for third-party content, qualification decisions, or availability."],
    ["Limitation of liability", "To the maximum extent permitted by law, the service is provided 'as is' without warranties. Liability is limited as permitted by applicable law."],
    ["Changes to the service", "Features, rewards, and terms may change. Material changes will be communicated."],
  ];
  return (
    <div className="container max-w-3xl py-14">
      <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-01-01 · Placeholder — pending legal review.</p>
      <div className="mt-6 space-y-6">
        {sections.map(([t, b]) => (
          <section key={t}><h2 className="font-semibold">{t}</h2><p className="mt-1 text-sm text-muted-foreground">{b}</p></section>
        ))}
      </div>
    </div>
  );
}
