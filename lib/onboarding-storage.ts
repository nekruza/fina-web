/**
 * Client-side (localStorage) persistence for the pre-signup onboarding
 * questionnaire (tutor, language, level, motivation, and daily goal).
 *
 * Ported from fina's onboarding AsyncStorage keys (`chosenTutor`,
 * `onboardingData` — see `lib/AuthContext.tsx` and `app/assessment.tsx`) —
 * consolidated into a single JSON blob under
 * `ONBOARDING_KEY` since the web flow has no per-key AsyncStorage history to
 * stay compatible with, and the whole flow runs before sign-up.
 *
 * SSR-safe: every read/write is a no-op when `window` is unavailable.
 */
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { isTutorId, type TutorId } from "@/lib/tutors";

export interface OnboardingData {
  tutor: TutorId;
  language: LanguageId;
  level: string;
  motivation: string;
  goal: number;
}

export const ONBOARDING_KEY = "fina_onboarding";

function readRaw(): Partial<OnboardingData> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Partial<OnboardingData>;
    }
    return {};
  } catch {
    return {};
  }
}

function writeRaw(data: Partial<OnboardingData>): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
  } catch {
    // Best-effort — a full or blocked storage shouldn't break onboarding.
  }
}

/** Reads the currently saved (possibly partial) onboarding answers. */
export function loadOnboarding(): Partial<OnboardingData> {
  return readRaw();
}

/** Merges `patch` into the saved answers, persists, and returns the merged result. */
export function saveOnboarding(patch: Partial<OnboardingData>): Partial<OnboardingData> {
  const next = { ...readRaw(), ...patch };
  writeRaw(next);
  return next;
}

/** Clears all saved onboarding answers (called once they've synced to the profile). */
export function clearOnboarding(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(ONBOARDING_KEY);
  } catch {
    // Best-effort.
  }
}

/** True once every onboarding answer required by `POST /api/profile/onboarding` is valid. */
export function isCompleteOnboarding(d: Partial<OnboardingData>): d is OnboardingData {
  return (
    isTutorId(d.tutor) &&
    isLanguageId(d.language) &&
    typeof d.level === "string" &&
    d.level.length > 0 &&
    typeof d.motivation === "string" &&
    d.motivation.length > 0 &&
    typeof d.goal === "number"
  );
}

/** True when the signed-in user's profile still needs the onboarding questionnaire. */
export function needsOnboarding(row: { target_language: string | null } | null): boolean {
  return !row || !row.target_language;
}
