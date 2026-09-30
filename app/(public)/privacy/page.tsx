import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { SectionHeading } from "@/components/fx/primitives";

// TODO(legal): this is a serious placeholder for an early-stage service.
// It MUST be reviewed by qualified legal counsel before production launch.

export const metadata: Metadata = baseMetadata({
  title: "Privacy Policy",
  description: `How ${siteConfig.name} handles account, profile, device, and payment information.`,
});

export default function PrivacyPage() {
  return (
    <main id="privacy-main">
      <a className="skip-link" href="#privacy-main">Skip to content</a>
      <article className="legal-page">
        <SectionHeading
          eyebrow="YOUR DATA, EXPLAINED"
          title="Privacy Policy"
          description="Last updated: 2026-01-01 · Placeholder — pending legal review."
        />
        <div className="surface">
          <section><h2>1. Information we collect</h2>
            <ul>
              <li><strong>Account information:</strong> email address, password (hashed), country, preferences.</li>
              <li><strong>Profile / demographic information:</strong> e.g. age range, gender (including prefer-not-to-say), employment, education, household size — only what is needed for opportunity matching.</li>
              <li><strong>Device / security information:</strong> IP-derived country, login history, basic abuse-prevention signals.</li>
              <li><strong>Survey / task interaction information:</strong> opportunities viewed, started, completed, and provider event references.</li>
              <li><strong>Payment / withdrawal information:</strong> requested amounts, methods, destinations, and payout status.</li>
            </ul>
          </section>
          <section><h2>2. Third-party providers</h2>
            <p>When you choose to participate in a third-party opportunity, that provider may process information needed to deliver and validate the opportunity (e.g. completion confirmations). We do not share more than is necessary.</p>
          </section>
          <section><h2>3. Use of information</h2>
            <p>We use information to operate accounts, match opportunities, credit rewards, prevent fraud, and comply with legal obligations.</p>
          </section>
          <section><h2>4. Retention & rights</h2>
            <p>You may request access, correction, or deletion of your data via {siteConfig.supportEmail}. Some records (e.g. ledger and fraud-prevention logs) may be retained as required for accounting, security, and legal compliance.</p>
          </section>
          <section><h2>5. Contact</h2>
            <p>Questions: <a className="text-link" href={`mailto:${siteConfig.supportEmail}`}>{siteConfig.supportEmail}</a>.</p>
          </section>
        </div>
      </article>
    </main>
  );
}
