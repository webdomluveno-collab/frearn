"use client";

import { useState, type FormEvent, type ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/fx/primitives";
import { Brand } from "@/components/fx/brand";
import { Icon } from "@/components/fx/icon";
import { TallyMark } from "@/components/fx/tally";
import { getSupabaseBrowser, isSupabaseConfigured } from "@/lib/auth/client";
import { siteConfig } from "@/config/site";
import { COUNTRIES, isValidCountryCode, normalizeCountryCode } from "@/lib/countries";

function AuthShell({ title, sub, children }: { title: string; sub: string; children: ReactNode }) {
  return (
    <div className="auth-page">
      <a className="skip-link" href="#auth-main">
        Skip to form
      </a>
      <aside className="auth-brand-panel">
        <Brand light />
        <div className="auth-brand-story">
          <span className="eyebrow">YOUR TIME ADDS UP</span>
          <h2>
            ONE SMALL
            <br />
            THING.
            <br />
            <span>
              THEN
              <br />
              ANOTHER.
            </span>
          </h2>
          <p>
            A survey. A game. A task.
            <br />A growing history of time well spent.
          </p>
          <div className="auth-tally-art" aria-hidden="true">
            <TallyMark size={250} />
            <span>
              EVERY MARK
              <br />
              IS A START.
            </span>
          </div>
        </div>
        <span className="auth-brand-footer">At your pace. On your terms.</span>
      </aside>
      <main id="auth-main" className="auth-form-panel">
        <header className="auth-topbar">
          <div className="auth-mobile-brand">
            <Brand />
          </div>
          <Link href="/" className="text-link">
            Back to Freearn
          </Link>
        </header>
        <div className="auth-form-container">
          <h1>{title}</h1>
          <p className="auth-description">{sub}</p>
          {children}
        </div>
        <footer className="auth-footer">
          <span>© {new Date().getFullYear()} {siteConfig.name}</span>
          <Link href="/contact">Need a hand?</Link>
        </footer>
      </main>
    </div>
  );
}

function FormError({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <p id="auth-error" role="alert" className="form-error">
      {message}
    </p>
  );
}

function NotConfigured() {
  return (
    <div className="notice notice-warning" role="alert">
      Sign-in is unavailable: authentication is not configured yet. Please try again later.
    </div>
  );
}

function PasswordField({
  id,
  label,
  value,
  onChange,
  autoComplete,
  minLength,
  forgotLink,
  describedBy = "auth-error",
}: {
  id: string;
  label: ReactNode;
  value: string;
  onChange: (v: string) => void;
  autoComplete: string;
  minLength?: number;
  forgotLink?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="field">
      <div className="auth-password-label">
        <label htmlFor={id}>{label}</label>
        {forgotLink && <Link href="/forgot-password">Forgot password?</Link>}
      </div>
      <div className="password-input">
        <input
          id={id}
          type={visible ? "text" : "password"}
          autoComplete={autoComplete}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          maxLength={128}
          minLength={minLength}
          required
          aria-describedby={describedBy}
        />
        <button
          type="button"
          onClick={() => setVisible(!visible)}
          aria-label={visible ? "Hide password" : "Show password"}
        >
          <Icon name={visible ? "eye-off" : "eye"} size={18} />
        </button>
      </div>
    </div>
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
    <AuthShell title="A little more starts here." sub="Good to see you again. Pick up where you left off.">
      {!configured && <NotConfigured />}
      <form className="form-stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="email">Email address</label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            aria-describedby="auth-error"
          />
        </div>
        <PasswordField
          id="password"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="current-password"
          forgotLink
        />
        <FormError message={error} />
        <Button type="submit" className="full-width" disabled={loading || !configured} aria-busy={loading}>
          {loading ? "Signing in…" : "Log in"}
        </Button>
      </form>
      <p className="auth-switch">
        New around here? <Link href="/register">Create an account</Link>
      </p>
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
    // Country must be a 2-letter ISO code (char(2) column) — never a full name.
    const countryCode = normalizeCountryCode(country);
    if (!isValidCountryCode(countryCode)) {
      setError("Please select your country from the list.");
      return;
    }
    setLoading(true);
    try {
      const supabase = getSupabaseBrowser();
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { country: countryCode },
          emailRedirectTo: `${siteConfig.url}/auth/callback?next=/dashboard`,
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
        <div className="auth-success">
          <span className="success-symbol">
            <Icon name="check" size={28} />
          </span>
          <p>
            Click the link in the email to verify your account, then sign in. The link brings
            you straight to your dashboard.
          </p>
          <p className="auth-switch">
            <Link href="/login">Back to log in</Link>
          </p>
        </div>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Your first little win awaits." sub="Make a little more of the time you already have.">
      {!configured && <NotConfigured />}
      <form className="form-stack" onSubmit={submit} noValidate>
        <div className="field">
          <label htmlFor="r-email">Email address</label>
          <input
            id="r-email"
            type="email"
            autoComplete="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={254}
            required
            aria-describedby="auth-error"
          />
        </div>
        <PasswordField
          id="r-pass"
          label="Password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />
        <p className="small muted">At least 8 characters.</p>
        <div className="field">
          <label htmlFor="r-country">Country</label>
          <select
            id="r-country"
            required
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            aria-describedby="auth-error"
          >
            <option value="" disabled>
              Select your country
            </option>
            {COUNTRIES.map((c) => (
              <option key={c.code} value={c.code}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <label className="terms-row">
          <input type="checkbox" required /> I accept the <Link href="/terms">Terms</Link> and{" "}
          <Link href="/privacy">Privacy Policy</Link>.
        </label>
        <FormError message={error} />
        <Button type="submit" className="full-width" disabled={loading || !configured} aria-busy={loading}>
          {loading ? "Creating…" : "Create account"}
        </Button>
      </form>
      <p className="auth-switch">
        Already have an account? <Link href="/login">Log in</Link>
      </p>
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
        redirectTo: `${siteConfig.url}/auth/callback?next=/reset-password`,
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
    <AuthShell title="Let’s get you back in." sub="Enter your email and we’ll send a reset link.">
      {!configured && <NotConfigured />}
      {done ? (
        <div className="auth-success">
          <span className="success-symbol">
            <Icon name="check" size={28} />
          </span>
          <h2>Your next step is clear.</h2>
          <p>If an account exists for that email, a reset link is on its way.</p>
          <p className="auth-switch">
            <Link href="/login">Back to log in</Link>
          </p>
        </div>
      ) : (
        <form className="form-stack" onSubmit={submit} noValidate>
          <div className="field">
            <label htmlFor="f-email">Email address</label>
            <input
              id="f-email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              maxLength={254}
              required
              aria-describedby="auth-error"
            />
          </div>
          <FormError message={error} />
          <Button type="submit" className="full-width" disabled={loading || !configured} aria-busy={loading}>
            {loading ? "Sending…" : "Send reset link"}
          </Button>
        </form>
      )}
      <p className="auth-switch">
        <Link href="/login">Back to log in</Link>
      </p>
    </AuthShell>
  );
}

export function ResetPasswordForm() {
  const router = useRouter();
  const configured = isSupabaseConfigured();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!configured) return;
    if (password !== confirm) {
      setError("The passwords do not match.");
      return;
    }
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
    <AuthShell title="A fresh start for your account." sub="Choose a new password below.">
      {!configured && <NotConfigured />}
      <form className="form-stack" onSubmit={submit} noValidate>
        <PasswordField
          id="n-pass"
          label="New password"
          value={password}
          onChange={setPassword}
          autoComplete="new-password"
          minLength={8}
        />
        <div className="field">
          <label htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            autoComplete="new-password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            maxLength={128}
            required
            placeholder="The same new password"
          />
        </div>
        <FormError message={error} />
        <Button type="submit" className="full-width" disabled={loading || !configured} aria-busy={loading}>
          {loading ? "Saving…" : "Save new password"}
        </Button>
      </form>
    </AuthShell>
  );
}
