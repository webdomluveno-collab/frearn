"use client";

import { NATIVE_CRYPTO_NAMES, PAYOUT_RULES } from "@/lib/withdrawals";
import { centsToUsd } from "@/lib/money";
import { useState } from "react";
import { Icon } from "./icon";
import { Button } from "./primitives";

export interface FaqItem {
  q: string;
  a: string;
}

export const FAQ_ITEMS: FaqItem[] = [
  {
    q: "What is Freearn?",
    a: "Freearn is an early-access rewards platform where users complete online surveys — and later other tasks — and track transparent rewards in one wallet.",
  },
  {
    q: "How do I earn rewards?",
    a: "Create a profile, choose opportunities matched to you, and complete them. Each opportunity shows estimated time and reward before you start.",
  },
  {
    q: "How much can I earn?",
    a: "It depends on your country, profile, and available opportunities. We show reward-per-minute so you can decide if an opportunity is worth your time. We don't promise fixed income.",
  },
  {
    q: "Are opportunities available in every country?",
    a: "No. Availability varies by country and profile. We're gradually expanding access around the world.",
  },
  {
    q: "Why might I not qualify for a survey?",
    a: "Surveys target specific demographics (e.g. age range, region, household). Starting a survey does not guarantee completion or reward — if you don't match the required profile, you may be screened out without payment.",
  },
  {
    q: "How do withdrawals work?",
    a: `Cash out from just ${centsToUsd(PAYOUT_RULES.revolut.minimumCents)} with Revolut. Native ${NATIVE_CRYPTO_NAMES} from ${centsToUsd(PAYOUT_RULES.cfx.minimumCents)}. Litecoin, SOL, USDC on Solana and USDC on BNB Smart Chain (BEP20) from ${centsToUsd(PAYOUT_RULES.sol.minimumCents)}. Skrill from ${centsToUsd(PAYOUT_RULES.skrill.minimumCents)}, with fees deducted from payout. PayPal is limited to historical withdrawals; card payouts are coming soon. Every request is manually reviewed — most within approximately 1 hour, with up to 3 days in exceptional cases. Requested funds are reserved immediately and returned if rejected. One active request per account is allowed at a time. Revolut is our fastest payout option. Review times are estimates, not guarantees.`,
  },
  {
    q: "What information do I need to provide?",
    a: "Email, password, country, and basic profile details used for matching (such as age range or employment status). We don't request unnecessary sensitive data.",
  },
  {
    q: "Can I create multiple accounts?",
    a: "No — one account per person. Duplicate accounts, automation, VPN-based location misrepresentation, and false profile information may lead to suspension and reversal of rewards.",
  },
];

export function FaqAccordion({ items = FAQ_ITEMS }: { items?: FaqItem[] }) {
  const [query, setQuery] = useState("");
  const filtered = items.filter(
    (f) =>
      query.trim() === "" ||
      `${f.q} ${f.a}`.toLowerCase().includes(query.toLowerCase().trim())
  );
  return (
    <div>
      <div className="help-search">
        <Icon name="search" size={17} />
        <input
          aria-label="Search answers"
          placeholder="Search answers"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>
      {filtered.length ? (
        <div className="faq-list">
          {filtered.map((f) => (
            <details key={f.q}>
              <summary>
                {f.q}
                <Icon name="plus" size={17} />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      ) : (
        <div className="faq-empty">
          <p>
            <strong>No answers match that search.</strong>
          </p>
          <p className="muted">Try “pending”, “withdrawal”, or “country”.</p>
          <Button variant="secondary" onClick={() => setQuery("")}>
            Clear search
          </Button>
        </div>
      )}
    </div>
  );
}
