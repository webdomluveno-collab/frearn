// @vitest-environment jsdom
import { mkdirSync, writeFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import EarnPage from "@/app/dashboard/earn/page";
import SettingsPage from "@/app/dashboard/settings/page";
import ProfilePage from "@/app/dashboard/profile/page";
import DashboardLoading from "@/app/dashboard/loading";
import DashboardError from "@/app/dashboard/error";
import { ActivityView } from "@/components/fx/activity-view";
import { summarizeLedger } from "@/lib/wallet/ledger";
import type { LedgerTransaction } from "@/types";
import DashboardOverview from "@/app/dashboard/page";
import { FxAppShell } from "@/components/fx/app-shell";
import { WalletView } from "@/components/fx/wallet-view";
const mocks=vi.hoisted(()=>({ledger:vi.fn(),path:"/dashboard"}));
vi.mock("next/navigation",()=>({usePathname:()=>mocks.path,useRouter:()=>({refresh:vi.fn(),push:vi.fn()})}));
vi.mock("@/lib/auth/server",()=>({getSessionUser:async()=>({id:"verified",email:"a-very-long-account-name-for-layout-checks@example.com"})}));
vi.mock("@/lib/db/wallet",()=>({getMyLedger:mocks.ledger}));
vi.mock("@/lib/providers/mock",()=>({isMockAllowed:()=>false}));
vi.mock("@/lib/providers",()=>({getSurveyWall:()=>({isConfigured:()=>false})}));
vi.mock("@/lib/auth/client",()=>({getSupabaseBrowser:()=>({auth:{signOut:vi.fn()}})}));
afterEach(()=>{cleanup();vi.unstubAllGlobals();window.history.replaceState(null,"",window.location.pathname);});
// Optional throwaway visual fixtures. Never served by production routes or committed.
function capture(name:string,html:string){
  const dir=process.env.FREEARN_QA_DIR;if(!dir)return;
  mkdirSync(dir,{recursive:true});writeFileSync(`${dir}/${name}.fragment.html`,html);
}
const summary={availableCents:10,pendingCents:0,lifetimeCents:10,reservedCents:0};
function shell(children:React.ReactNode){return <FxAppShell email="a-very-long-account-name-for-layout-checks@example.com" initial="A" availableCents={10}>{children}</FxAppShell>;}
describe("production screens render their actual ledger inputs",()=>{
  it("dashboard empty state contains no fabricated rewards",async()=>{
    mocks.path="/dashboard";mocks.ledger.mockResolvedValue([]);
    const page=await DashboardOverview();const html=renderToStaticMarkup(shell(page));
    expect(mocks.ledger).toHaveBeenCalledWith("verified");expect(html).toContain("$0.00");expect(html).toContain("Withdraw from $0.10");
    capture("dashboard",html);
    mocks.path="/dashboard/earn";capture("earn",renderToStaticMarkup(shell(<EarnPage/>)));
    mocks.path="/dashboard/transactions";capture("activity",renderToStaticMarkup(shell(<ActivityView txns={[]}/>)));
    mocks.path="/dashboard/settings";capture("settings",renderToStaticMarkup(shell(<SettingsPage/>)));
    mocks.path="/dashboard/profile";capture("profile",renderToStaticMarkup(shell(<ProfilePage/>)));
    capture("loading",renderToStaticMarkup(shell(<DashboardLoading/>)));
    capture("error",renderToStaticMarkup(shell(<DashboardError error={new Error("local QA")} reset={()=>{}}/>)));
  });
  it("wallet form and long Solana address fit the actual production components",()=>{
    mocks.path="/dashboard/wallet";
    const view=render(shell(<WalletView txns={[]} summary={{...summary,availableCents:100,lifetimeCents:100}} withdrawals={[]}/>));
    fireEvent.click(screen.getByRole("button",{name:"Withdraw rewards"}));fireEvent.click(screen.getByRole("button",{name:"USDC (Solana)"}));
    const address="7".repeat(44);fireEvent.change(screen.getByLabelText("Solana wallet address"),{target:{value:address}});
    expect(screen.getByLabelText("Solana wallet address")).toHaveValue(address);
    capture("wallet-form",view.container.innerHTML);
    fireEvent.click(screen.getByRole("button",{name:"Skrill"}));
    capture("wallet-skrill",view.container.innerHTML);
    fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:"0.99"}});
    fireEvent.submit(screen.getByRole("form",{name:"Request a withdrawal"}));
    capture("wallet-error",view.container.innerHTML);
    fireEvent.click(screen.getByRole("button",{name:"USDC (Solana)"}));
    fireEvent.change(screen.getByLabelText("Solana wallet address"),{target:{value:address}});
    fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:"1.00"}});fireEvent.submit(screen.getByRole("form",{name:"Request a withdrawal"}));
    expect(screen.getByRole("button",{name:"Confirm $1.00 withdrawal"})).toBeEnabled();capture("wallet-review",view.container.innerHTML);
  });
  it("pending history renders masked long destinations and review status",()=>{
    mocks.path="/dashboard/wallet";
    const view=render(shell(<WalletView txns={[]} summary={summary} withdrawals={[{id:"one",amountCents:10,method:"paypal",methodLabel:"PayPal",maskedDestination:"a***@an-extremely-long-destination-domain-for-layout-testing.example.com",status:"requested",createdAt:"2026-10-07T12:00:00Z"}]}/>));
    fireEvent.click(screen.getByRole("button",{name:"Withdrawals (1)"}));expect(screen.getByText("Pending",{exact:true})).toBeVisible();
    capture("wallet-pending",view.container.innerHTML);
  });
  it("populated screens show confirmed rewards minus the existing withdrawal hold",async()=>{
    const txns:LedgerTransaction[]=[
      {id:"long-reference-for-layout-checks-1234567890",userId:"verified",type:"survey_reward",status:"confirmed",amountCents:34567,description:"A long provider activity description to check narrow history rows",idempotencyKey:"qa-reward",createdAt:new Date().toISOString()},
      {id:"pending",userId:"verified",type:"offer_reward",status:"pending",amountCents:987,description:"Pending offer reward",idempotencyKey:"qa-pending",createdAt:new Date().toISOString()},
      {id:"hold",userId:"verified",type:"withdrawal",status:"pending",amountCents:-100,description:"Withdrawal request",idempotencyKey:"qa-hold",createdAt:new Date().toISOString()},
    ];
    mocks.path="/dashboard";mocks.ledger.mockResolvedValue(txns);
    const page=await DashboardOverview();const html=renderToStaticMarkup(shell(page));
    expect(html).toContain("$344.67");expect(html).toContain("$9.87");expect(html).toContain("$345.67");
    capture("dashboard-funded",html);
    mocks.path="/dashboard/transactions";capture("activity-funded",renderToStaticMarkup(shell(<ActivityView txns={txns}/>)));
    mocks.path="/dashboard/wallet";capture("wallet-funded",renderToStaticMarkup(shell(<WalletView txns={txns} summary={summarizeLedger(txns)} withdrawals={[]}/>)));
  });

});
