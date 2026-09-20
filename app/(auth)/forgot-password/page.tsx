"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { getAuthOrigin } from "@/lib/auth-redirect";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAuthOrigin()}/auth/callback?next=/app/settings`,
    });

    if (resetError) {
      setError(resetError.message);
      setLoading(false);
      return;
    }

    setSuccess(true);
    setLoading(false);
  }

  if (success) {
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
        <h2 className="font-display text-2xl font-bold text-ink mb-2">Check your email</h2>
        <p className="text-sm mb-6 text-sub">
          If an account exists for <span className="font-medium text-ink">{email}</span>, we sent a password reset
          link.
        </p>
        <Link href="/login" className="text-sm font-semibold text-accent-brand hover:underline">
          Back to Sign In
        </Link>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="font-display text-3xl font-bold text-ink mb-2">Reset password</h1>
        <p className="text-sm text-sub">Enter your email and we&apos;ll send you a reset link</p>
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

        {error && (
          <div role="alert" className="rounded-xl px-4 py-3 text-sm border border-hot/25 bg-hot/10 text-hot">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full h-11 rounded-xl font-bold text-sm text-white bg-ink transition-opacity disabled:opacity-50 mt-1"
        >
          {loading ? "Sending…" : "Send Reset Link"}
        </button>
      </form>

      <p className="text-center text-sm mt-6 text-sub">
        Remember your password?{" "}
        <Link href="/login" className="font-semibold text-accent-brand hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
