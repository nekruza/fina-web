"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";
import { safeNext } from "@/lib/safe-next";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";

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
  const [oauthLoading, setOauthLoading] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = safeNext(nextParam);
  const displayedError = error ?? (searchParams.get("error") === "auth_callback_failed"
    ? "Sign-in could not be completed. Please try again with Apple, Google, or your email below."
    : null);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || oauthLoading) return;
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

      <SocialSignInButtons
        next={next}
        disabled={loading}
        onError={setError}
        onPendingChange={setOauthLoading}
      />

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
          disabled={loading || oauthLoading}
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
