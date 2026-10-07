// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { LoginForm, RegisterForm, ForgotForm, ResetPasswordForm } from "@/components/auth-forms";
import { SignOutButton } from "@/components/sign-out-button";
const mocks = vi.hoisted(() => ({
  push:vi.fn(),refresh:vi.fn(),configured:true,
  signInWithPassword:vi.fn(),signUp:vi.fn(),resetPasswordForEmail:vi.fn(),updateUser:vi.fn(),signOut:vi.fn()
}));
vi.mock("next/navigation",()=>({useRouter:()=>({push:mocks.push,refresh:mocks.refresh})}));
vi.mock("@/lib/auth/client",()=>({isSupabaseConfigured:()=>mocks.configured,getSupabaseBrowser:()=>({auth:mocks})}));
beforeEach(()=>{cleanup();vi.clearAllMocks();mocks.configured=true;});
function input(label:string,value:string){fireEvent.change(screen.getByLabelText(label,{exact:true}),{target:{value}});}
function submit(button:string){fireEvent.submit(screen.getByRole("button",{name:button}).closest("form")!);}
function registration(){render(<RegisterForm/>);input("Email address","new@example.com");input("Password","validpassword");fireEvent.change(screen.getByLabelText("Country"),{target:{value:"CZ"}});fireEvent.click(screen.getByRole("checkbox"));}
describe("production auth handlers after visual integration",()=>{
  it("login calls Supabase and redirects/refetches the real dashboard",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:null});render(<LoginForm/>);
    input("Email address","one@example.com");input("Password","validpassword");submit("Log in");
    await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.signInWithPassword).toHaveBeenCalledWith({email:"one@example.com",password:"validpassword"});
    expect(mocks.refresh).toHaveBeenCalled();
  });
  it("auth errors show an alert without a success redirect",async()=>{
    mocks.signInWithPassword.mockResolvedValue({error:{message:"Invalid login credentials"}});render(<LoginForm/>);
    input("Email address","one@example.com");input("Password","wrongpassword");submit("Log in");
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid login credentials");expect(mocks.push).not.toHaveBeenCalled();
  });
  it("login disables duplicate submits while waiting for Supabase",async()=>{
    let finish!:(v:unknown)=>void;mocks.signInWithPassword.mockReturnValue(new Promise(r=>{finish=r;}));render(<LoginForm/>);
    input("Email address","one@example.com");input("Password","validpassword");submit("Log in");
    expect(screen.getByRole("button",{name:"Signing in…"})).toBeDisabled();
    finish({error:null});await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
  });
  it("missing Supabase config disables login instead of creating a demo session",()=>{
    mocks.configured=false;render(<LoginForm/>);expect(screen.getByRole("button",{name:"Log in"})).toBeDisabled();
    expect(screen.getByRole("alert")).toHaveTextContent("authentication is not configured");
    expect(mocks.signInWithPassword).not.toHaveBeenCalled();
  });
  it("registration sends ISO country and shows confirmation when session is absent",async()=>{
    mocks.signUp.mockResolvedValue({data:{session:null},error:null});registration();submit("Create account");
    expect(await screen.findByRole("heading",{name:"Check your email"})).toBeVisible();
    expect(mocks.signUp).toHaveBeenCalledWith(expect.objectContaining({options:expect.objectContaining({data:{country:"CZ"}})}));
    expect(mocks.push).not.toHaveBeenCalled();
  });
  it("registration with a real SDK session goes to dashboard",async()=>{
    mocks.signUp.mockResolvedValue({data:{session:{access_token:"test-only"}},error:null});registration();submit("Create account");
    await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
  });
  it("registration retains native country, password and terms validation",()=>{
    render(<RegisterForm/>);expect(screen.getByRole("checkbox")).toBeRequired();
    expect(screen.getByLabelText("Country")).toBeRequired();
    expect(screen.getByLabelText("Password",{exact:true})).toHaveAttribute("minlength","8");
    expect(screen.getByRole("button",{name:"Create account"}).closest("form")).not.toHaveAttribute("novalidate");
  });
  it("forgot password calls real reset API with the callback route",async()=>{
    mocks.resetPasswordForEmail.mockResolvedValue({error:null});render(<ForgotForm/>);input("Email address","one@example.com");
    fireEvent.submit(screen.getByLabelText("Email address").closest("form")!);
    await waitFor(()=>expect(mocks.resetPasswordForEmail).toHaveBeenCalledWith("one@example.com",expect.objectContaining({redirectTo:expect.stringContaining("/auth/callback?next=/reset-password")})));
  });
  it("logout calls Supabase signOut then clears server views by redirect/refresh",async()=>{
    mocks.signOut.mockResolvedValue({error:null});render(<SignOutButton/>);fireEvent.click(screen.getByRole("button",{name:"Sign out"}));
    await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith("/login"));expect(mocks.signOut).toHaveBeenCalledOnce();expect(mocks.refresh).toHaveBeenCalled();
  });
  it("reset updates the real SDK session and redirects only after success",async()=>{
    mocks.updateUser.mockResolvedValue({error:null});render(<ResetPasswordForm/>);
    input("New password","validpassword");input("Confirm new password","validpassword");submit("Save new password");
    await waitFor(()=>expect(mocks.push).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.updateUser).toHaveBeenCalledWith({password:"validpassword"});
  });
  it("reset rejects mismatched passwords without calling Supabase",()=>{
    render(<ResetPasswordForm/>);input("New password","validpassword");input("Confirm new password","differentpassword");submit("Save new password");
    expect(screen.getByRole("alert")).toHaveTextContent("do not match");expect(mocks.updateUser).not.toHaveBeenCalled();
  });
  it("reset form remains connected to the production password handler",()=>{
    render(<ResetPasswordForm/>);expect(screen.getByRole("heading",{level:1})).toBeVisible();
    expect(screen.getAllByLabelText(/password/i).filter(el=>el.tagName==="INPUT").length).toBeGreaterThanOrEqual(2);
  });
});
