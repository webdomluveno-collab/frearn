"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";

function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="container flex max-w-md flex-col py-14">
      <Card><CardHeader><CardTitle>{title}</CardTitle><CardDescription>{sub}</CardDescription></CardHeader>
      <CardContent>{children}</CardContent></Card>
    </div>
  );
}

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  return (
    <AuthShell title="Welcome back" sub="Sign in to your account.">
      {/* TODO(auth): wire Supabase Auth + rate limiting + bot protection */}
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div><Label htmlFor="email">Email</Label><Input id="email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        <div><Label htmlFor="password">Password</Label><Input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>
        <Button className="w-full" type="submit">Sign in</Button>
        <p className="text-sm text-muted-foreground"><Link className="underline" href="/forgot-password">Forgot password?</Link>{" · "}<Link className="underline" href="/register">Create account</Link></p>
      </form>
    </AuthShell>
  );
}

export function RegisterForm() {
  return (
    <AuthShell title="Create your account" sub="Join early access. Live earning isn't available yet.">
      {/* TODO(auth): email verification, Google login later, anti-bot later */}
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div><Label htmlFor="r-email">Email</Label><Input id="r-email" type="email" autoComplete="email" required /></div>
        <div><Label htmlFor="r-pass">Password</Label><Input id="r-pass" type="password" autoComplete="new-password" required minLength={8} /></div>
        <div><Label htmlFor="r-country">Country</Label><Input id="r-country" placeholder="e.g. Germany" autoComplete="country-name" required /></div>
        <label className="flex items-start gap-2 text-sm text-muted-foreground">
          <input type="checkbox" required className="mt-1" /> I accept the <Link className="underline" href="/terms">Terms</Link> and <Link className="underline" href="/privacy">Privacy Policy</Link>.
        </label>
        <Button className="w-full" type="submit">Create account</Button>
        <p className="text-sm text-muted-foreground">Already have an account? <Link className="underline" href="/login">Sign in</Link></p>
      </form>
    </AuthShell>
  );
}

export function ForgotForm() {
  return (
    <AuthShell title="Reset password" sub="We'll email you a reset link if the address exists.">
      <form className="space-y-4" onSubmit={(e) => e.preventDefault()}>
        <div><Label htmlFor="f-email">Email</Label><Input id="f-email" type="email" required /></div>
        <Button className="w-full" type="submit">Send reset link</Button>
      </form>
    </AuthShell>
  );
}
