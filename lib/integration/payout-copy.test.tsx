// @vitest-environment jsdom
import { renderToStaticMarkup } from "react-dom/server";
import { describe,expect,it,vi } from "vitest";
vi.mock("next/navigation",()=>({useRouter:()=>({push:vi.fn(),refresh:vi.fn()})}));
import Homepage from "@/app/(public)/page";
import { FaqAccordion } from "@/components/fx/faq";

describe("public payout policy copy",()=>{
  const html=renderToStaticMarkup(<Homepage/>);
  it("qualifies the ten-cent offer with Revolut",()=>{
    expect(html).toContain("Cash out from just $0.10 with Revolut.");
    expect(html).toContain("Native crypto withdrawals from $0.10");
    expect(html).toContain("LTC, SOL and USDC from $1.00");
  });
  it("keeps Revolut fastest, native crypto at ten cents, Skrill with fees and PayPal historical",()=>{
    expect(html).toContain("Revolut is our fastest option");
    expect(html).toContain("CFX, RVN, 0G, IOTX, XNO");
    expect(html).toContain("Skrill from $1.00, with fees deducted from payout");
    expect(html).not.toContain("<h3>PayPal</h3>");
    expect(html).toContain("COMING SOON");
    expect(html).toContain("PayPal is available only for historical withdrawals");
    expect(html).not.toMatch(/fee.free|guaranteed instant|guaranteed within one hour/i);
    expect(html).not.toContain("Revolut and Skrill");
  });
  it("FAQ exposes both minima and both USDC networks",()=>{
    const faq=renderToStaticMarkup(<FaqAccordion/>);
    expect(faq).toContain("$0.10");expect(faq).toContain("$1.00");
    expect(faq).toContain("BEP20");expect(faq).toContain("Solana");
  });
});
