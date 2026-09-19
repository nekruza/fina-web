/**
 * Browser-only preferences that are not part of the deployed `profiles`
 * table. Values are scoped to the authenticated user so another account on
 * the same browser cannot inherit the previous account's tutor or language.
 */
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { DEFAULT_TUTOR_ID, isTutorId, type TutorId } from "@/lib/tutors";

export const USER_PREFERENCES_KEY = "fina_user_preferences";

export interface UserPreferences {
  tutorId: TutorId;
  nativeLanguage: LanguageId;
  dailyGoalMinutes: number;
}

const DEFAULT_PREFERENCES: UserPreferences = {
  tutorId: DEFAULT_TUTOR_ID,
  nativeLanguage: "english",
  dailyGoalMinutes: 10,
};

const DAILY_GOALS = [5, 10, 20, 30] as const;

function keyFor(userId: string): string {
  return `${USER_PREFERENCES_KEY}:${userId}`;
}

export function hasUserPreferences(userId: string | null | undefined): boolean {
  if (typeof window === "undefined" || !userId) return false;
  try {
    return window.localStorage.getItem(keyFor(userId)) !== null;
  } catch {
    return false;
  }
}

function readRaw(userId: string | null | undefined): Partial<UserPreferences> {
  if (typeof window === "undefined" || !userId) return {};

  try {
    const raw = window.localStorage.getItem(keyFor(userId));
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as Partial<UserPreferences>)
      : {};
  } catch {
    return {};
  }
}

/** Reads saved preferences, falling back to stable app defaults. */
export function loadUserPreferences(userId: string | null | undefined): UserPreferences {
  const raw = readRaw(userId);
  return {
    tutorId: isTutorId(raw.tutorId) ? raw.tutorId : DEFAULT_PREFERENCES.tutorId,
    nativeLanguage: isLanguageId(raw.nativeLanguage) ? raw.nativeLanguage : DEFAULT_PREFERENCES.nativeLanguage,
    dailyGoalMinutes: DAILY_GOALS.includes(raw.dailyGoalMinutes as (typeof DAILY_GOALS)[number])
      ? raw.dailyGoalMinutes!
      : DEFAULT_PREFERENCES.dailyGoalMinutes,
  };
}

/** Persists a validated preference patch for one signed-in user. */
export function saveUserPreferences(userId: string, patch: Partial<UserPreferences>): UserPreferences {
  const next = { ...loadUserPreferences(userId), ...patch };

  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(keyFor(userId), JSON.stringify(next));
    } catch {
      // Best-effort — blocked or full storage should not interrupt the app.
    }
  }

  return next;
}

export function clearUserPreferences(userId: string): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(userId));
  } catch {
    // Best-effort.
  }
}
