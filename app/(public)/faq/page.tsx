import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { SectionHeading } from "@/components/fx/primitives";
import { FaqAccordion } from "@/components/fx/faq";

export const metadata: Metadata = baseMetadata({ title: "FAQ", description: "Honest answers about earning, qualification, availability, and withdrawals." });

export default function FaqPage() {
  return (
    <main id="faq-main">
      <a className="skip-link" href="#faq-main">Skip to content</a>
      <div className="legal-page">
        <SectionHeading
          eyebrow="NO HYPE, JUST ANSWERS"
          title="Frequently asked questions"
          description="Clear, honest answers — no hype."
        />
        <FaqAccordion />
      </div>
    </main>
  );
}
