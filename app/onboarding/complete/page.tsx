"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { loadOnboarding, clearOnboarding, isCompleteOnboarding } from "@/lib/onboarding-storage";
import { saveUserPreferences } from "@/lib/user-preferences";

/**
 * Runs after sign-up (or for an already-signed-in user finishing setup):
 * syncs the locally-saved onboarding answers to the profile, then lands on
 * `/app`. Ported from fina's `lib/AuthContext.tsx` SIGNED_IN handler, which
 * does the equivalent AsyncStorage → Supabase profile sync on the mobile app.
 */
export default function OnboardingCompletePage() {
  const router = useRouter();
  const [error, setError] = useState(false);
  const [pending, setPending] = useState(false);

  const run = useCallback(async () => {
    setPending(true);
    try {
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/signup?next=/onboarding/complete");
        return;
      }

      const onboarding = loadOnboarding();
      if (!isCompleteOnboarding(onboarding)) {
        router.replace("/onboarding");
        return;
      }

      const res = await fetch("/api/profile/onboarding", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(onboarding),
      });

      if (res.ok) {
        saveUserPreferences(user.id, { tutorId: onboarding.tutor, dailyGoalMinutes: onboarding.goal });
        clearOnboarding();
        router.replace("/app");
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setPending(false);
    }
  }, [router]);

  useEffect(() => {
    async function execute() {
      await run();
    }
    execute();
  }, [run]);

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-cream px-6 text-center">
        <p className="mb-4 text-base text-ink">Something went wrong setting up your plan.</p>
        <button
          type="button"
          onClick={run}
          disabled={pending}
          className="rounded-2xl bg-ink px-6 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Retrying…" : "Try again"}
        </button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-cream px-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-line border-t-ink" aria-hidden />
      <p role="status" className="text-base text-sub">
        Setting up your plan…
      </p>
    </div>
  );
}
