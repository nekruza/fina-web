"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";
import { safeNext } from "@/lib/safe-next";

type SocialProvider = "google" | "apple";

interface SocialSignInButtonsProps {
  next: string;
  disabled: boolean;
  onError: (message: string | null) => void;
  onPendingChange: (pending: boolean) => void;
}

export function SocialSignInButtons({ next, disabled, onError, onPendingChange }: SocialSignInButtonsProps) {
  const [pending, setPending] = useState<SocialProvider | null>(null);

  async function signIn(provider: SocialProvider) {
    if (pending || disabled) return;
    setPending(provider);
    onPendingChange(true);
    onError(null);
    track("Auth Started", { method: provider });

    try {
      const { error } = await createClient().auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?next=${encodeURIComponent(safeNext(next))}`,
        },
      });
      if (error) throw error;
    } catch (error) {
      onError(error instanceof Error ? error.message : "Couldn’t start sign-in. Please try again.");
      setPending(null);
      onPendingChange(false);
    }
  }

  return (
    <div className="space-y-3">
      {(["google", "apple"] as const).map((provider) => (
        <button
          key={provider}
          type="button"
          onClick={() => signIn(provider)}
          disabled={disabled || pending !== null}
          aria-busy={pending === provider}
          className={`flex h-12 w-full items-center justify-center gap-2.5 rounded-xl border text-sm font-bold transition-colors disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${provider === "apple" ? "border-black bg-black text-white hover:bg-black/85" : "border-line bg-surface text-ink hover:border-ink/40"}`}
        >
          {provider === "apple" ? <AppleIcon /> : <GoogleIcon />}
          {pending === provider ? "Redirecting…" : `Continue with ${provider === "apple" ? "Apple" : "Google"}`}
        </button>
      ))}
    </div>
  );
}

function AppleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" className="shrink-0">
      <path d="M17.05 12.04c.03 3.29 2.89 4.38 2.92 4.4-.02.08-.46 1.57-1.51 3.11-.91 1.33-1.85 2.65-3.34 2.68-1.46.03-1.93-.87-3.6-.87s-2.19.84-3.57.9c-1.44.05-2.53-1.44-3.45-2.77C2.62 16.77 1.18 11.8 3.11 8.45c.96-1.66 2.67-2.71 4.52-2.74 1.41-.03 2.74.95 3.6.95.85 0 2.46-1.18 4.15-1.01.71.03 2.7.29 3.98 2.16-.1.07-2.38 1.38-2.31 4.23ZM14.3 3.85c.76-.92 1.27-2.2 1.13-3.48-1.1.04-2.44.74-3.23 1.66-.71.81-1.33 2.11-1.16 3.36 1.23.09 2.49-.63 3.26-1.54Z" />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true" className="shrink-0">
      <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
      <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
      <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" />
      <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
    </svg>
  );
}
