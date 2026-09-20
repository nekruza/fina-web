"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";
import { safeNext } from "@/lib/safe-next";
import { SocialSignInButtons } from "@/components/auth/SocialSignInButtons";

export default function SignupPage() {
  return (
    <Suspense>
      <SignupForm />
    </Suspense>
  );
}

function SignupForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState(false);
  const [checkEmail, setCheckEmail] = useState(false);
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextParam = searchParams.get("next");
  const next = safeNext(nextParam);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (loading || oauthLoading) return;
    setLoading(true);
    setError(null);
    track("Auth Started", { method: "email" });

    const { data, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    if (data.session) {
      router.replace(next);
      return;
    }

    setCheckEmail(true);
    setLoading(false);
  }

  if (checkEmail) {
    return (
      <div className="text-center py-4">
        <div className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-5 bg-accent-soft border border-accent-brand/20">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
            <path
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
              stroke="#2E5E3E"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Check your email to confirm your account.</h2>
        <p className="text-sm mb-6 text-sub">
          We sent a confirmation link to <span className="font-medium text-ink">{email}</span>.
        </p>
        <Link href="/login" className="text-sm font-semibold text-accent-brand hover:underline">
          Back to login
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink mb-2">Create your account</h1>
        <p className="text-sm text-sub">Save your plan and pick up where you left off, on any device.</p>
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
            placeholder="At least 8 characters"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={8}
            className="w-full h-11 px-4 rounded-xl text-sm outline-none border border-line bg-surface text-ink transition-colors focus:border-accent-brand focus:ring-2 focus:ring-accent-soft"
          />
        </div>

        {error && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm border border-hot/25 bg-hot/10 text-hot">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading || oauthLoading}
          className="w-full h-11 rounded-xl font-bold text-sm text-white bg-ink transition-opacity disabled:opacity-50 mt-1"
        >
          {loading ? "Creating account…" : "Create account"}
        </button>
      </form>

      <p className="text-center text-sm mt-6 text-sub">
        Already have an account?{" "}
        <Link href={`/login?next=${encodeURIComponent(next)}`} className="font-semibold text-accent-brand hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
