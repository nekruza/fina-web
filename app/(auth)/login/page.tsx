"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";
import { safeNext } from "@/lib/safe-next";

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = safeNext(nextParam);
  const displayedError = error ?? (searchParams.get("error") === "auth_callback_failed"
    ? "Sign-in could not be completed. Please start again using Google or your email below."
    : null);
  const supabase = createClient();

  async function handleGoogleSignIn() {
    setGoogleLoading(true);
    setError(null);
    track("Auth Started", { method: "google" });
    const callbackUrl = `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`;
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: callbackUrl },
    });
    if (oauthError) {
      setError(oauthError.message);
      setGoogleLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    track("Auth Started", { method: "email" });

    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      setError(signInError.message);
      setLoading(false);
      return;
    }

    router.replace(next);
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink mb-2">Welcome back</h1>
        <p className="text-sm text-sub">Pick up your plan where you left off.</p>
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={googleLoading}
        className="w-full flex items-center justify-center gap-2.5 h-12 rounded-xl text-sm font-bold border border-line bg-surface text-ink transition-colors hover:border-ink/40 disabled:opacity-50"
      >
        <GoogleIcon />
        {googleLoading ? "Redirecting…" : "Continue with Google"}
      </button>

      <div className="flex items-center gap-3 my-6">
        <div className="h-px flex-1 bg-line" />
        <span className="text-xs uppercase tracking-wide text-sub">or</span>
        <div className="h-px flex-1 bg-line" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label htmlFor="email" className="block text-xs font-semibold uppercase tracking-wider text-sub">
            Email
          </label>
          <input
            id="email"
            type="email"
            aria-label="Email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="w-full h-11 px-4 rounded-xl text-sm outline-none border border-line bg-surface text-ink transition-colors focus:border-accent-brand focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="block text-xs font-semibold uppercase tracking-wider text-sub">
            Password
          </label>
          <input
            id="password"
            type="password"
            aria-label="Password"
            placeholder="••••••••"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full h-11 px-4 rounded-xl text-sm outline-none border border-line bg-surface text-ink transition-colors focus:border-accent-brand focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        {displayedError && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm border border-hot/25 bg-hot/10 text-hot">
            {displayedError}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl font-bold text-sm text-white bg-ink transition-opacity disabled:opacity-50 mt-1"
        >
          {loading ? "Signing in…" : "Log in"}
        </button>
      </form>

      <div className="flex items-center justify-between mt-6 text-sm">
        <Link href="/forgot-password" className="font-medium text-sub hover:text-ink transition-colors">
          Forgot password?
        </Link>
        <Link href="/onboarding" className="font-semibold text-accent-brand hover:underline">
          New to Fina? Get started
        </Link>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" className="flex-shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
