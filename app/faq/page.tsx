import type { Metadata } from "next";
import { baseMetadata } from "@/lib/seo";
import { FaqAccordion } from "@/components/faq-waitlist";

export const metadata: Metadata = baseMetadata({ title: "FAQ", description: "Honest answers about earning, qualification, availability, and withdrawals." });

export default function FaqPage() {
  return (
    <div className="container max-w-3xl py-14">
      <h1 className="text-3xl font-bold tracking-tight">Frequently asked questions</h1>
      <p className="mt-2 text-muted-foreground">Clear, honest answers — no hype.</p>
      <div className="mt-8"><FaqAccordion /></div>
    </div>
  );
}
