// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { WalletView, type WithdrawalListItem } from "@/components/fx/wallet-view";
const mocks=vi.hoisted(()=>({refresh:vi.fn()}));
vi.mock("next/navigation",()=>({useRouter:()=>({refresh:mocks.refresh})}));
const summary={availableCents:10,pendingCents:0,lifetimeCents:10,reservedCents:0};
const active:WithdrawalListItem={id:"one",amountCents:10,method:"revolut",methodLabel:"Revolut",maskedDestination:"@so***ne",status:"requested",createdAt:"2026-10-07T12:00:00Z"};
beforeEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
function show(){fireEvent.click(screen.getByRole("button",{name:"Withdraw rewards"}));}
function fill(amount="0.10"){fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:amount}});fireEvent.change(screen.getByLabelText("Revolut @username"),{target:{value:"@someone"}});fireEvent.submit(screen.getByRole("form",{name:"Request a withdrawal"}));}
describe("real wallet integration UI",()=>{
  it("exact ten-cent balance opens the real withdrawal review",()=>{
    render(<WalletView txns={[]} summary={summary} withdrawals={[]}/>);show();fill();
    expect(screen.getByRole("button",{name:"Confirm $0.10 withdrawal"})).toBeEnabled();
  });
  it("nine cents cannot be submitted",()=>{
    render(<WalletView txns={[]} summary={summary} withdrawals={[]}/>);show();fill("0.09");
    expect(screen.getByRole("alert")).toHaveTextContent("minimum withdrawal is $0.10");
  });
  it("all live methods remain available and card collects no details",()=>{
    render(<WalletView txns={[]} summary={summary} withdrawals={[]}/>);show();
    for(const name of ["PayPal","Skrill","Revolut","SOL","USDC (Solana)"]) expect(screen.getByRole("button",{name})).toBeEnabled();
    expect(screen.getByRole("button",{name:"Card — Soon"})).toBeDisabled();
    expect(screen.queryByLabelText(/CVV|card number|expiry/i)).not.toBeInTheDocument();
  });
  it.each(["requested","reviewing","approved","processing"])("disables another request while %s",status=>{
    render(<WalletView txns={[]} summary={summary} withdrawals={[{...active,status}]}/>);
    expect(screen.getByRole("button",{name:"Withdrawal under review"})).toBeDisabled();
    expect(screen.getByRole("status")).toHaveTextContent("One withdrawal at a time");
  });
  it("failed request-history read is explicit and blocks requesting",()=>{
    render(<WalletView txns={[]} summary={summary} withdrawals={[]} withdrawalsUnavailable/>);
    expect(screen.getByRole("button",{name:"Withdrawals unavailable"})).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("could not be loaded");
  });
  it("success posts to production API, refreshes the server balance and prevents immediate repeat",async()=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal("fetch",fetcher);
    render(<WalletView txns={[]} summary={summary} withdrawals={[]}/>);show();fill();fireEvent.click(screen.getByRole("button",{name:"Confirm $0.10 withdrawal"}));
    await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledWith("/api/withdrawals/request",expect.objectContaining({method:"POST",credentials:"same-origin"}));
    expect(JSON.parse(fetcher.mock.calls[0][1].body)).toEqual(expect.objectContaining({amountCents:10,method:"revolut",destination:"@someone"}));
    expect(screen.getByRole("button",{name:"Withdrawal under review"})).toBeDisabled();
  });
  it("RPC conflict explains the pending protection without success",async()=>{
    vi.stubGlobal("fetch",vi.fn().mockResolvedValue({ok:false,json:async()=>({error:"pending_withdrawal"})}));
    render(<WalletView txns={[]} summary={summary} withdrawals={[]}/>);show();fill();fireEvent.click(screen.getByRole("button",{name:"Confirm $0.10 withdrawal"}));
    expect(await screen.findByRole("alert")).toHaveTextContent("already have a withdrawal under review");expect(mocks.refresh).not.toHaveBeenCalled();
  });
  it("empty wallet shows zero and the real empty state",()=>{
    render(<WalletView txns={[]} summary={{...summary,availableCents:0,lifetimeCents:0}} withdrawals={[]}/>);
    expect(screen.getByText("Your first win is still ahead.")).toBeVisible();
    expect(screen.getByRole("button",{name:"Withdraw from $0.10"})).toBeDisabled();
  });
});
