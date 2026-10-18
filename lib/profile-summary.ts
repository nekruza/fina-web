/**
 * Shapes a raw `ProfileRow` (plus the counts/aggregates gathered by
 * `GET /api/profile`) into the camelCase `ProfileSummary` the UI consumes.
 *
 * Pure and side-effect free so the route handler stays a thin orchestration
 * layer — this is what makes the fallback/guard logic unit-testable without
 * a database.
 */
import { isUserLevel, type UserLevel } from "@/lib/levels";
import { isLanguageId, getLanguage, type LanguageId } from "@/lib/languages";
import { getTutorById, type TutorId } from "@/lib/tutors";
import { hasProAccess, FREE_CONVERSATIONS, FREE_GENERATIONS } from "@/lib/billing";
import { parseWeeklyActivity } from "@/lib/streak";
import { parseCompletedDays } from "@/lib/db/profile";
import type { ProfileRow, ProfileSummary } from "@/lib/types/profile";

export interface BuildProfileSummaryInput {
  user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> };
  row: ProfileRow | null;
  conversations: { completed: number; avgOverallScore: number | null; total: number };
  lessonsCompleted: number;
  favoriteWords: number;
  /** Surviving generated_lessons rows, shown as a stat. */
  generatedLessons: number;
  /** Generation usage counted from the current generated_lessons table. */
  generationEvents: number;
  now?: Date;
}

export function buildProfileSummary(input: BuildProfileSummaryInput): ProfileSummary {
  const { user, row, conversations, lessonsCompleted, favoriteWords, generatedLessons, generationEvents } = input;
  const now = input.now ?? new Date();

  const email = user.email ?? row?.email ?? "";

  const fullName =
    typeof user.user_metadata?.full_name === "string" ? (user.user_metadata.full_name as string) : null;
  const displayName = row?.display_name || fullName || (email ? email.split("@")[0] : "") || "there";

  const rawLevel = row?.user_level ?? null;
  const level: UserLevel = isUserLevel(rawLevel) ? rawLevel : "beginner";

  const rawNative = row?.native_language ?? null;
  const nativeLanguage: LanguageId = isLanguageId(rawNative) ? rawNative : "russian";

  const targetLanguage: LanguageId = getLanguage(row?.target_language ?? null).id;
  const tutorId: TutorId = getTutorById(row?.tutor_id ?? null).id;
  const dailyGoalMinutes = row?.daily_goal_minutes ?? 10;

  const isPro = hasProAccess(row, now);

  const freeConversationsRemaining = isPro ? 999 : Math.max(0, FREE_CONVERSATIONS - conversations.total);
  const freeGenerationsRemaining = isPro ? 999 : Math.max(0, FREE_GENERATIONS - generationEvents);

  return {
    id: user.id,
    email,
    displayName,
    level,
    targetLanguage,
    nativeLanguage,
    tutorId,
    dailyGoalMinutes,
    learningMotivation: row?.learning_motivation ?? null,
    onboarded: Boolean(row?.target_language),
    streak: {
      current: row?.current_streak ?? 0,
      lastConversationDate: row?.last_conversation_date ?? null,
      weeklyActivity: parseWeeklyActivity(row?.weekly_activity ?? null),
    },
    studyPlan: {
      startDate: row?.study_plan_start_date ?? null,
      completedDays: parseCompletedDays(row?.study_plan_completed_days ?? null),
    },
    stats: {
      conversationsCompleted: conversations.completed,
      avgOverallScore: conversations.avgOverallScore,
      lessonsCompleted,
      favoriteWords,
      generatedLessons,
    },
    pro: {
      isPro,
      status: row?.pro_status ?? null,
      currentPeriodEnd: row?.pro_current_period_end ?? null,
      hasCustomer: Boolean(row?.stripe_customer_id),
      hasSubscription: Boolean(row?.stripe_subscription_id),
    },
    usage: { freeConversationsRemaining, freeGenerationsRemaining },
    createdAt: row?.created_at ?? now.toISOString(),
  };
}
