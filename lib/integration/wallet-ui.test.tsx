// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { METHOD_CASES } from "../withdrawals/__tests__/cases";
import { toWithdrawalListItem } from "../withdrawal-presentation";
import { AdminWithdrawalActions } from "@/components/admin-withdrawals";
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
    expect(screen.getByRole("alert")).toHaveTextContent("Revolut minimum is $0.10");
  });
  it("all live methods remain available and card collects no details",()=>{
    render(<WalletView txns={[]} summary={summary} withdrawals={[]}/>);show();
    for(const name of METHOD_CASES.map(c=>c.label)) expect(screen.getByRole("button",{name})).toBeEnabled();
    expect(screen.getByRole("button",{name:"Card — Coming soon"})).toBeDisabled();
    expect(screen.queryByRole("button",{name:"PayPal"})).not.toBeInTheDocument();
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

describe("method-specific wallet form",()=>{
  it.each(METHOD_CASES)("$label displays its minimum immediately and rejects below it",({label,minimum})=>{
    render(<WalletView txns={[]} summary={{...summary,availableCents:100,lifetimeCents:100}} withdrawals={[]}/>);show();
    fireEvent.click(screen.getByRole("button",{name:label}));
    expect(document.getElementById("wd-amount-help")).toHaveTextContent(`${label} — Minimum $${(minimum/100).toFixed(2)}`);
    expect(screen.getByLabelText("Amount (USD)")).toHaveAttribute("placeholder",(minimum/100).toFixed(2));
    fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:((minimum-1)/100).toFixed(2)}});
    fireEvent.submit(screen.getByRole("form",{name:"Request a withdrawal"}));
    expect(screen.getByRole("alert")).toHaveTextContent(`${label} minimum is $${(minimum/100).toFixed(2)}.`);
  });
  it.each(METHOD_CASES)("$label reviews exactly its minimum",({label,minimum,destination,destinationLabel})=>{
    render(<WalletView txns={[]} summary={{...summary,availableCents:minimum,lifetimeCents:minimum}} withdrawals={[]}/>);show();
    fireEvent.click(screen.getByRole("button",{name:label}));
    fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:(minimum/100).toFixed(2)}});
    fireEvent.change(screen.getByLabelText(destinationLabel),{target:{value:destination}});
    fireEvent.submit(screen.getByRole("form",{name:"Request a withdrawal"}));
    expect(screen.getByRole("button",{name:`Confirm $${(minimum/100).toFixed(2)} withdrawal`})).toBeEnabled();
  });
  it("switching to crypto revalidates the entered amount; Revolut clears stale minimum errors",()=>{
    render(<WalletView txns={[]} summary={{...summary,availableCents:100,lifetimeCents:100}} withdrawals={[]}/>);show();
    fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:"0.10"}});
    fireEvent.click(screen.getByRole("button",{name:"SOL"}));expect(screen.getByRole("alert")).toHaveTextContent("SOL minimum is $1.00");
    fireEvent.click(screen.getByRole("button",{name:"Revolut"}));expect(screen.queryByRole("alert")).not.toBeInTheDocument();
    expect(document.getElementById("wd-amount-help")).toHaveTextContent("Revolut — Minimum $0.10");
  });
  it.each(["skrill","paypal"])("historical %s remains server-masked and readable",method=>{
    const row=toWithdrawalListItem({...active,method,destination:"legacy@example.com",status:"paid"});
    expect(row.methodLabel).toBe(method==="skrill"?"Skrill":"PayPal");expect(row.maskedDestination).toBe("l***@example.com");expect(row).not.toHaveProperty("destination");
    render(<WalletView txns={[]} summary={summary} withdrawals={[row]}/>);
    fireEvent.click(screen.getByRole("button",{name:"Withdrawals (1)"}));
    expect(screen.getByText(`$0.10 · ${row.methodLabel}`)).toBeVisible();expect(screen.getByText(/l\*\*\*@example.com/)).toBeVisible();
    expect(screen.queryByText("legacy@example.com")).not.toBeInTheDocument();
  });
  it.each([["Mark paid","approve","skrill"],["Reject","reject","skrill"],["Mark paid","approve","paypal"],["Reject","reject","paypal"]])("admin can still %s a historical request (%s/%s)",async(label,action,method)=>{
    const fetcher=vi.fn().mockResolvedValue({ok:true,json:async()=>({})});vi.stubGlobal("fetch",fetcher);
    render(<AdminWithdrawalActions rows={[{...active,userId:"owner",method,destination:"old@example.com"}]}/>);
    expect(screen.getByText(method==="skrill"?"Skrill":"PayPal")).toBeVisible();fireEvent.click(screen.getByRole("button",{name:label}));
    await waitFor(()=>expect(mocks.refresh).toHaveBeenCalledOnce());
    expect(fetcher).toHaveBeenCalledWith(`/api/admin/withdrawals/one/${action}`,expect.objectContaining({method:"POST",credentials:"same-origin"}));
  });
});

it("Skrill displays fee deduction both before review and before confirming",()=>{
  render(<WalletView txns={[]} summary={{...summary,availableCents:100,lifetimeCents:100}} withdrawals={[]}/>);show();
  fireEvent.click(screen.getByRole("button",{name:"Skrill"}));
  expect(screen.getByText(/Skrill fees are deducted from the requested amount/)).toBeVisible();
  fireEvent.change(screen.getByLabelText("Amount (USD)"),{target:{value:"1.00"}});
  fireEvent.change(screen.getByLabelText("Skrill email"),{target:{value:"user@example.com"}});
  fireEvent.submit(screen.getByRole("form",{name:"Request a withdrawal"}));
  expect(screen.getByText(/Skrill fees are deducted from the requested amount/)).toBeVisible();
  expect(screen.getByRole("button",{name:"Confirm $1.00 withdrawal"})).toBeEnabled();
  expect(screen.queryByText(/12.55/)).not.toBeInTheDocument();
});
