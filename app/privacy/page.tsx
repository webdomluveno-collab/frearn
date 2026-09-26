import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";

// TODO(legal): this is a serious placeholder for an early-stage service.
// It MUST be reviewed by qualified legal counsel before production launch.

export const metadata: Metadata = baseMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} handles account, profile, device, and payment information.`,
});

export default function PrivacyPage() {
  return (
    <article className="container max-w-3xl py-14 prose-sm">
      <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
      <p className="mt-2 text-sm text-muted-foreground">Last updated: 2026-01-01 · Placeholder — pending legal review.</p>
      <div className="mt-6 space-y-6 text-sm leading-7 text-muted-foreground">
        <section><h2 className="text-lg font-semibold text-foreground">1. Information we collect</h2>
          <ul className="list-disc pl-5">
            <li><strong>Account information:</strong> email address, password (hashed), country, preferences.</li>
            <li><strong>Profile / demographic information:</strong> e.g. age range, gender (including prefer-not-to-say), employment, education, household size — only what is needed for opportunity matching.</li>
            <li><strong>Device / security information:</strong> IP-derived country, login history, basic abuse-prevention signals.</li>
            <li><strong>Survey / task interaction information:</strong> opportunities viewed, started, completed, and provider event references.</li>
            <li><strong>Payment / withdrawal information:</strong> requested amounts, methods, destinations, and payout status.</li>
          </ul>
        </section>
        <section><h2 className="text-lg font-semibold text-foreground">2. Third-party providers</h2>
          <p>When you choose to participate in a third-party opportunity, that provider may process information needed to deliver and validate the opportunity (e.g. completion confirmations). We do not share more than is necessary.</p>
        </section>
        <section><h2 className="text-lg font-semibold text-foreground">3. Use of information</h2>
          <p>We use information to operate accounts, match opportunities, credit rewards, prevent fraud, and comply with legal obligations.</p>
        </section>
        <section><h2 className="text-lg font-semibold text-foreground">4. Retention & rights</h2>
          <p>You may request access, correction, or deletion of your data via {siteConfig.supportEmail}. Some records (e.g. ledger and fraud-prevention logs) may be retained as required for accounting, security, and legal compliance.</p>
        </section>
        <section><h2 className="text-lg font-semibold text-foreground">5. Contact</h2>
          <p>Questions: <a className="underline" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.</p>
        </section>
      </div>
    </article>
  );
}
