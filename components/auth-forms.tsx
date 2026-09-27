"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/auth/client";

function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="container flex max-w-md flex-col py-14">
      <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{sub}</CardDescription></CardHeader>
      <CardContent>{children}</CardContent></Card>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return <p role="alert" className="rounded-xl bg-red-500/10 p-3 text-sm text-red-700 dark:text-red-300">{message}</p>;
}

function NotConfigured() {
  return (
    <p role="alert" className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-800 dark:text-amber-200">
      Sign-in is unavailable: authentication is not configured yet. Please try again later.
    </p>
  );
}

export function LoginForm() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: signInError } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (signInError) {
        setError(signInError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign-in failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Welcome back" sub="Sign in to your account.">
      {!configured && <NotConfigured />}
      <form className="space-y-4" onSubmit={submit}>
        <FormError message={error} />
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={loading || !configured}>{loading ? "Signing in…" : "Sign in"}</Button>
        <p className="text-sm text-muted-foreground"><Link className="underline" href="/forgot-password">Forgot password?</Link>{" · "}<Link className="underline" href="/register">Create account</Link></p>
      </form>
    </AuthShell>
  );
}

export function RegisterForm() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [country, setCountry] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const siteUrl = window.location.origin;
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { country: country.trim() },
          emailRedirectTo: `${siteUrl}/auth/callback?next=/dashboard`,
        },
      });
      if (signUpError) {
        setError(signUpError.message);
        return;
      }
      // If email confirmation is on, there is no session yet — tell the user to check email.
      if (!data.session) {
        setCheckEmail(true);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  if (checkEmail) {
    return (
      <AuthShell title="Check your email" sub="We sent you a confirmation link.">
        <p className="text-sm text-muted-foreground">
          Click the link in the email to verify your account, then sign in. The link brings you straight to your dashboard.
        </p>
        <p className="mt-4 text-sm text-muted-foreground"><Link className="underline" href="/login">Back to sign in</Link></p>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" sub="One account per person. Live earning is rolling out gradually.">
      {!configured && <NotConfigured />}
      <form className="space-y-4" onSubmit={submit}>
        <FormError message={error} />
        <div><Label htmlFor="r-email">Email</Label><Input id="r-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="r-pass">Password</Label><Input id="r-pass" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <div><Label htmlFor="r-country">Country</Label><Input id="r-country" placeholder="e.g. Germany" autoComplete="country-name" required value={country} onChange={(e) => setCountry(e.target.value)} /></div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" required className="mt-1" /> I accept the <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy Policy</Link>.
        </label>
        <Button className="w-full" type="submit" disabled={loading || !configured}>{loading ? "Creating…" : "Create account"}</Button>
        <p className="text-sm text-muted-foreground">Already have an account? <Link className="underline" href="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}

export function ForgotForm() {
  const configured = isSupabaseConfigured();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(email.trim(), {
        redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
      });
      if (resetError) {
        setError(resetError.message);
        return;
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Request failed. Please try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Reset password" sub="We'll email you a reset link if the address exists.">
      {!configured && <NotConfigured />}
      {done ? (
        <p role="status" className="text-sm text-muted-foreground">If an account exists for that email, a reset link is on its way.</p>
      ) : (
        <form className="space-y-4" onSubmit={submit}>
          <FormError message={error} />
          <div><Label htmlFor="f-email">Email</Label><Input id="f-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <Button className="w-full" type="submit" disabled={loading || !configured}>{loading ? "Sending…" : "Send reset link"}</Button>
        </form>
      )}
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    setError(null);
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) {
        setError(updateError.message);
        return;
      }
      router.push("/dashboard");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell title="Choose a new password" sub="Enter your new password below.">
      {!configured && <NotConfigured />}
      <form className="space-y-4" onSubmit={submit}>
        <FormError message={error} />
        <div><Label htmlFor="n-pass">New password</Label><Input id="n-pass" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" type="submit" disabled={loading || !configured}>{loading ? "Saving…" : "Save new password"}</Button>
      </form>
    </AuthShell>
  );
}
