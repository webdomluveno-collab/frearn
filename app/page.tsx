import { Hero } from "@/components/hero";
import { HowItWorks } from "@/components/how-it-works";
import { Transparency } from "@/components/transparency";
import { OpportunityTypes } from "@/components/opportunity-types";
import { GlobalSection } from "@/components/global-section";
import { WalletPreview } from "@/components/wallet-preview";
import { TrustSection } from "@/components/trust-section";
import { FaqWaitlistSection } from "@/components/faq-waitlist";

export default function HomePage() {
  return (
    <>
      <Hero />
      <HowItWorks />
      <Transparency />
      <OpportunityTypes />
      <GlobalSection />
      <WalletPreview />
      <TrustSection />
      <FaqWaitlistSection />
    </>
  );
}
