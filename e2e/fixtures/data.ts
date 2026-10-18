/**
 * Shared response shapes for the E2E suite.
 *
 * These mirror what the real API returns, so a drift between fixture and
 * handler shows up as a failing test rather than a silently passing one.
 */
import type { LanguageAnalysis } from "@/lib/types/conversation";
import type { Lesson, VocabularyWord } from "@/lib/types/vocabulary";
import type { ProfileSummary } from "@/lib/types/profile";

export const E2E_ACCESS_TOKEN = "e2e-access-token";

export const E2E_USER = {
  id: "e2e-user-0000-0000-000000000001",
  email: "e2e@example.com",
};

/** Matches the `ProfileSummary` returned by GET /api/profile. */
export function profileFixture(overrides: Partial<ProfileSummary> = {}): ProfileSummary {
  return {
    id: E2E_USER.id,
    email: E2E_USER.email,
    displayName: "E2E Tester",
    level: "intermediate",
    targetLanguage: "spanish",
    nativeLanguage: "english",
    tutorId: "luna",
    dailyGoalMinutes: 10,
    learningMotivation: "travel",
    onboarded: true,
    streak: {
      current: 2,
      lastConversationDate: null,
      weeklyActivity: [false, true, true, false, false, false, false],
    },
    studyPlan: { startDate: "2026-09-10T00:00:00.000Z", completedDays: [1] },
    stats: {
      conversationsCompleted: 4,
      avgOverallScore: 78,
      lessonsCompleted: 2,
      favoriteWords: 1,
      generatedLessons: 0,
    },
    pro: { isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false, hasSubscription: false },
    usage: { freeConversationsRemaining: 3, freeGenerationsRemaining: 3 },
    createdAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

/** Matches GET /api/conversations/usage. */
export function usageFixture(freeRemaining: number, isPro: boolean) {
  const freeLimit = 3;
  return {
    isPro,
    freeLimit,
    freeUsed: Math.max(0, freeLimit - freeRemaining),
    freeRemaining,
  };
}

/** Matches the graded result from POST /api/ai/feedback. */
export function analysisFixture(overrides: Partial<LanguageAnalysis> = {}): LanguageAnalysis {
  return {
    overall: 82,
    fluency: 80,
    grammar: 75,
    vocabulary: 85,
    engagement: 88,
    relevancy: 90,
    summary: "Clear structure, and you used good vocabulary throughout.",
    strengths: ["Confident greeting", "Used the past tense correctly"],
    corrections: [
      {
        original: "Yo tiene hambre",
        corrected: "Yo tengo hambre",
        explanation: "The first person singular of \"tener\" is \"tengo\".",
      },
    ],
    ...overrides,
  };
}

/** Matches the hints array from POST /api/ai/voice (isHint: true). */
export const hintsFixture = [
  "Me gustaría pedir la sopa, por favor.",
  "¿Qué me recomienda?",
  "¿Puedo ver el menú otra vez?",
  "La cuenta, por favor.",
];

function wordFixture(overrides: Partial<VocabularyWord> = {}): VocabularyWord {
  return {
    id: "e2e-word-1",
    title_id: 1,
    word: "cocinar",
    definition: "to cook",
    example: "Me gusta cocinar los fines de semana.",
    pronunciation: "koh-see-NAR",
    difficulty: "easy",
    category: "cooking",
    partOfSpeech: "verb",
    audioURL: null,
    ...overrides,
  };
}

/** Matches the `lesson` returned by POST /api/ai/vocabulary on success. */
export function lessonFixture(overrides: Partial<Lesson> = {}): Lesson {
  return {
    id: "e2e-lesson-1",
    title: "Cooking Basics",
    description: "Words for cooking a meal",
    wordsCount: 2,
    duration: "10 min",
    difficulty: "Beginner",
    completed: false,
    emoji: "🍳",
    vocabularyWords: [
      wordFixture(),
      wordFixture({
        id: "e2e-word-2",
        title_id: 2,
        word: "receta",
        definition: "recipe",
        example: "Esta receta es fácil de seguir.",
        pronunciation: "reh-SEH-tah",
        partOfSpeech: "noun",
      }),
    ],
    supabaseId: "e2e-lesson-1",
    isUserGenerated: true,
    ...overrides,
  };
}
