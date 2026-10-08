// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, within, waitFor } from "@testing-library/react";
import { FxAppShell } from "@/components/fx/app-shell";
import DashboardError from "@/app/dashboard/error";
import DashboardLoading from "@/app/dashboard/loading";
const mocks=vi.hoisted(()=>({push:vi.fn(),refresh:vi.fn(),signOut:vi.fn()}));
vi.mock("next/navigation",()=>({usePathname:()=>"/dashboard/wallet",useRouter:()=>({push:mocks.push,refresh:mocks.refresh})}));
vi.mock("@/lib/auth/client",()=>({getSupabaseBrowser:()=>({auth:{signOut:mocks.signOut}})}));
afterEach(()=>{cleanup();vi.clearAllMocks();});
function shell(){return render(<FxAppShell email="person@example.com" initial="P" availableCents={123}><p>Account content</p></FxAppShell>);}
describe("authenticated navigation and recovery",()=>{
  it("desktop and mobile keep working route links and the selected Wallet",()=>{
    shell();
    for(const name of ["Main navigation","Mobile navigation"]){
      const nav=within(screen.getByRole("navigation",{name}));
      expect(nav.getByRole("link",{name:"Dashboard"})).toHaveAttribute("href","/dashboard");
      expect(nav.getByRole("link",{name:"Earn"})).toHaveAttribute("href","/dashboard/earn");
      expect(nav.getByRole("link",{name:"Wallet"})).toHaveAttribute("aria-current","page");
    }
  });
  it("account menu exposes the same sign-out flow on every screen size",async()=>{
    mocks.signOut.mockResolvedValue({error:null});shell();
    const summary=screen.getByLabelText("Account menu");fireEvent.click(summary);
    const menu=summary.closest("details")!;
    expect(menu).toHaveAttribute("open");
    fireEvent.click(within(menu).getByRole("button",{name:"Sign out"}));
    await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith("/login"));
    expect(mocks.signOut).toHaveBeenCalledOnce();expect(mocks.refresh).toHaveBeenCalledOnce();
  });
  it("activity search still passes the escaped query to the existing route",()=>{
    shell();const input=screen.getByRole("textbox",{name:"Search activity"});
    fireEvent.change(input,{target:{value:"survey & games"}});fireEvent.submit(input.closest("form")!);
    expect(mocks.push).toHaveBeenCalledWith("/dashboard/transactions?q=survey%20%26%20games");
  });
  it("page errors retry without exposing internal errors",()=>{
    const reset=vi.fn();render(<DashboardError error={new Error("private backend detail")} reset={reset}/>);
    expect(screen.getByRole("alert")).not.toHaveTextContent("private backend detail");
    fireEvent.click(screen.getByRole("button",{name:"Try again"}));expect(reset).toHaveBeenCalledOnce();
  });
  it("loading announces its state without showing placeholder financial values",()=>{
    render(<DashboardLoading/>);
    expect(screen.getByRole("status")).toHaveAttribute("aria-busy","true");
    expect(document.body.textContent).not.toMatch(/\$\d/);
  });
});
