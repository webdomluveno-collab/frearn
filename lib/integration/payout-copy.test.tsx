// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import Homepage from "@/app/(public)/page";
import { FaqAccordion } from "@/components/fx/faq";

describe("public payout policy copy",()=>{
  const html=renderToStaticMarkup(<Homepage/>);
  it("qualifies the ten-cent offer with Revolut or PayPal",()=>{
    expect(html).toContain("Cash out from just $0.10 with Revolut or PayPal.");
    expect(html).toContain("Crypto withdrawals from $1.00");
  });
  it("keeps Revolut fastest, PayPal manual, card planned and Skrill historical",()=>{
    expect(html).toContain("Revolut is our fastest option");
    expect(html).toContain("Manual payments to your PayPal account.");
    expect(html).toContain("COMING SOON");
    expect(html).toContain("Skrill is available only for historical withdrawals");
    expect(html).not.toMatch(/fee.free|guaranteed instant|guaranteed within one hour/i);
    expect(html).not.toContain("Revolut and Skrill");
  });
  it("FAQ exposes both minima and both USDC networks",()=>{
    const faq=renderToStaticMarkup(<FaqAccordion/>);
    expect(faq).toContain("$0.10");expect(faq).toContain("$1.00");
    expect(faq).toContain("BEP20");expect(faq).toContain("Solana");
  });
});
