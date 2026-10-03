import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { siteConfig } from "@/config/site";
import { SectionHeading } from "@/components/fx/primitives";
import { Icon } from "@/components/fx/icon";
import Link from "next/link";

export const metadata: Metadata = baseMetadata({ title: "Contact" });

export default function ContactPage() {
  return (
    <main id="contact-main">
      <a className="skip-link" href="#contact-main">Skip to content</a>
      <div className="legal-page">
        <SectionHeading
          eyebrow="A LITTLE HELP GOES A LONG WAY"
          title="Let's get you back on track."
          description="We read every message."
        />
        <section className="surface support-panel">
          <div className="settings-panel-heading">
            <h2>Need a hand?</h2>
            <p className="muted small">Real replies from the Freearn team.</p>
          </div>
          <div className="setting-action">
            <div>
              <strong>Email us</strong>
              <p className="muted small">
                <a className="text-link" href={`mailto:${siteConfig.supportEmail}`}>
                  {siteConfig.supportEmail}
                </a>
              </p>
            </div>
            <Icon name="mail" size={20} />
          </div>
          <div className="notice">
            <Icon name="help" size={16} />
            <p>
              For provider/partnership inquiries, include your company, use case, and expected
              volume. Never include passwords or payment details.
              Looking for quick answers first? See the <Link href="/faq" className="text-link">FAQ</Link>.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
