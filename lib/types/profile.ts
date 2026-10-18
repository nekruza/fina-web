/**
 * Fina profile types.
 *
 * `ProfileRow` mirrors the `public.profiles` table exactly (snake_case,
 * nullable columns as stored). `ProfileSummary` is the shaped, camelCase
 * response returned by `/api/profile` and consumed by the UI. `ProfileUpdate`
 * is the subset of columns a caller may patch via `updateProfile`.
 */
import type { LanguageId } from "@/lib/languages";
import type { UserLevel } from "@/lib/levels";
import type { TutorId } from "@/lib/tutors";

export interface ProfileRow {
  id: string;
  email: string | null;
  display_name: string | null;
  user_level: UserLevel | null;
  current_streak: number | null;
  words_learned: number | null;
  accuracy: number | null;
  last_conversation_date: string | null;
  weekly_activity: string | null;
  target_language: string | null;
  learning_motivation: string | null;
  daily_goal_minutes?: number | null;
  ai_consent_accepted?: boolean | null;
  study_plan_completed_days: string | null;
  study_plan_start_date: string | null;
  /** Legacy web fields retained for compatibility with older fixtures only. */
  native_language?: string | null;
  tutor_id?: string | null;
  ai_consent_at?: string | null;
  stripe_customer_id?: string | null;
  stripe_subscription_id?: string | null;
  pro_status?: string | null;
  pro_current_period_end?: string | null;
  created_at: string;
  updated_at: string | null;
}

export interface ProfileSummary {
  id: string;
  email: string;
  displayName: string;
  level: UserLevel;
  targetLanguage: LanguageId;
  nativeLanguage: LanguageId;
  tutorId: TutorId;
  dailyGoalMinutes: number;
  learningMotivation: string | null;
  onboarded: boolean;
  streak: { current: number; lastConversationDate: string | null; weeklyActivity: boolean[] };
  studyPlan: { startDate: string | null; completedDays: number[] };
  stats: {
    conversationsCompleted: number;
    avgOverallScore: number | null;
    lessonsCompleted: number;
    favoriteWords: number;
    generatedLessons: number;
  };
  /**
   * `hasSubscription` is false for Pro granted without Stripe (a voucher
   * code, or set by hand), which has no billing portal and doesn't renew.
   */
  pro: {
    isPro: boolean;
    status: string | null;
    currentPeriodEnd: string | null;
    hasCustomer: boolean;
    hasSubscription: boolean;
  };
  usage: { freeConversationsRemaining: number; freeGenerationsRemaining: number };
  createdAt: string;
}

export type ProfileUpdate = Partial<
  Pick<
    ProfileRow,
    | "display_name"
    | "user_level"
    | "target_language"
    | "learning_motivation"
    | "study_plan_completed_days"
    | "study_plan_start_date"
    | "ai_consent_accepted"
  >
>;
