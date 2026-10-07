import { beforeEach, describe, expect, it, vi } from "vitest";
const mocks=vi.hoisted(()=>({user:vi.fn(),exchange:vi.fn(),ledger:vi.fn(),redirect:vi.fn((url:string)=>{throw new Error(`redirect:${url}`);})}));
vi.mock("next/navigation",()=>({redirect:mocks.redirect,usePathname:()=>"/dashboard",useRouter:()=>({})}));
vi.mock("@/lib/auth/server",()=>({getSessionUser:mocks.user,getSupabaseServer:()=>({auth:{exchangeCodeForSession:mocks.exchange}})}));
vi.mock("@/lib/db/wallet",()=>({getMyLedger:mocks.ledger}));
import DashboardLayout, { dynamic as dashboardRendering } from "@/app/dashboard/layout";
import { GET } from "@/app/auth/callback/route";
beforeEach(()=>{vi.clearAllMocks();});
describe("production session routes",()=>{
  it("unauthenticated dashboard redirects before reading a ledger",async()=>{
    expect(dashboardRendering).toBe("force-dynamic");mocks.user.mockResolvedValue(null);await expect(DashboardLayout({children:null})).rejects.toThrow("redirect:/login");expect(mocks.ledger).not.toHaveBeenCalled();
  });
  it("authenticated dashboard uses the verified user's ledger",async()=>{
    mocks.user.mockResolvedValue({id:"session-owner",email:"person@example.com"});mocks.ledger.mockResolvedValue([]);
    const result=await DashboardLayout({children:null});expect(mocks.ledger).toHaveBeenCalledWith("session-owner");expect(result.props.availableCents).toBe(0);
  });
  it.each(["/dashboard","/reset-password"])("confirmation exchanges the SDK code and redirects to %s",async next=>{
    mocks.exchange.mockResolvedValue({error:null});const res=await GET(new Request(`https://freearn.local/auth/callback?code=verified&next=${next}`));
    expect(mocks.exchange).toHaveBeenCalledWith("verified");expect(res.headers.get("location")).toBe(`https://freearn.local${next}`);
  });
  it.each(["https://evil.example","//evil.example","/\\evil.example"])("confirmation rejects an external redirect %s",async next=>{
    mocks.exchange.mockResolvedValue({error:null});const res=await GET(new Request(`https://freearn.local/auth/callback?code=verified&next=${encodeURIComponent(next)}`));
    expect(res.headers.get("location")).toBe("https://freearn.local/dashboard");
  });
  it("failed code exchange returns to login without a fabricated session",async()=>{
    mocks.exchange.mockResolvedValue({error:{message:"invalid"}});const res=await GET(new Request("https://freearn.local/auth/callback?code=bad"));
    expect(res.headers.get("location")).toBe("https://freearn.local/login?error=confirm");
  });
});
