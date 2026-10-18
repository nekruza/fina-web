import { buildProfileSummary } from "@/lib/profile-summary";
import type { ProfileRow } from "@/lib/types/profile";

const NOW = new Date("2026-09-13T10:00:00Z");

const ROW: ProfileRow = {
  id: "u1",
  email: "jane@example.com",
  display_name: "Jane",
  user_level: "intermediate",
  current_streak: 4,
  words_learned: 0,
  accuracy: 0,
  last_conversation_date: "2026-09-12",
  weekly_activity: "[true,false,false,false,false,false,true]",
  target_language: "spanish",
  learning_motivation: "travel",
  daily_goal_minutes: 20,
  study_plan_completed_days: "[1,2]",
  study_plan_start_date: "2026-09-01T00:00:00.000Z",
  native_language: "french",
  tutor_id: "henry",
  ai_consent_at: "2026-09-01T00:00:00.000Z",
  stripe_customer_id: "cus_1",
  stripe_subscription_id: "sub_1",
  pro_status: "active",
  pro_current_period_end: "2026-10-01T00:00:00.000Z",
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: null,
};

const CONVERSATIONS = { completed: 5, avgOverallScore: 80, total: 6 };

function baseInput(overrides: Partial<Parameters<typeof buildProfileSummary>[0]> = {}) {
  return {
    user: { id: "u1", email: "jane@example.com" as string | null },
    row: ROW,
    conversations: CONVERSATIONS,
    lessonsCompleted: 3,
    favoriteWords: 7,
    generatedLessons: 2,
    generationEvents: 2,
    now: NOW,
    ...overrides,
  };
}

describe("buildProfileSummary", () => {
  it("shapes a full row into camelCase ProfileSummary", () => {
    const summary = buildProfileSummary(baseInput());

    expect(summary).toEqual({
      id: "u1",
      email: "jane@example.com",
      displayName: "Jane",
      level: "intermediate",
      targetLanguage: "spanish",
      nativeLanguage: "french",
      tutorId: "henry",
      dailyGoalMinutes: 20,
      learningMotivation: "travel",
      onboarded: true,
      streak: {
        current: 4,
        lastConversationDate: "2026-09-12",
        weeklyActivity: [true, false, false, false, false, false, true],
      },
      studyPlan: { startDate: "2026-09-01T00:00:00.000Z", completedDays: [1, 2] },
      stats: { conversationsCompleted: 5, avgOverallScore: 80, lessonsCompleted: 3, favoriteWords: 7, generatedLessons: 2 },
      pro: { isPro: true, status: "active", currentPeriodEnd: "2026-10-01T00:00:00.000Z", hasCustomer: true },
      usage: { freeConversationsRemaining: 999, freeGenerationsRemaining: 999 },
      createdAt: "2026-08-01T00:00:00.000Z",
    });
  });

  describe("displayName fallback chain", () => {
    it("prefers the profile row's display_name", () => {
      expect(buildProfileSummary(baseInput()).displayName).toBe("Jane");
    });

    it("falls back to user_metadata.full_name when the row has none", () => {
      const summary = buildProfileSummary(
        baseInput({ row: { ...ROW, display_name: null }, user: { id: "u1", email: "jane@example.com", user_metadata: { full_name: "Full Name" } } })
      );
      expect(summary.displayName).toBe("Full Name");
    });

    it("falls back to the email prefix when there is no name anywhere", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, display_name: null } }));
      expect(summary.displayName).toBe("jane");
    });

    it("falls back to 'there' when there is no row, name, or email", () => {
      const summary = buildProfileSummary(baseInput({ row: null, user: { id: "u1", email: null } }));
      expect(summary.displayName).toBe("there");
    });
  });

  describe("defaults for a brand-new profile (row is null)", () => {
    const summary = buildProfileSummary(baseInput({ row: null, conversations: { completed: 0, avgOverallScore: null, total: 0 }, lessonsCompleted: 0, favoriteWords: 0, generatedLessons: 0 }));

    it("defaults nativeLanguage to russian", () => expect(summary.nativeLanguage).toBe("russian"));
    it("defaults tutorId to luna", () => expect(summary.tutorId).toBe("luna"));
    it("defaults targetLanguage to english", () => expect(summary.targetLanguage).toBe("english"));
    it("defaults level to beginner", () => expect(summary.level).toBe("beginner"));
    it("defaults dailyGoalMinutes to 10", () => expect(summary.dailyGoalMinutes).toBe(10));
    it("is not onboarded", () => expect(summary.onboarded).toBe(false));
    it("is not pro and has no customer", () => expect(summary.pro).toEqual({ isPro: false, status: null, currentPeriodEnd: null, hasCustomer: false }));
    it("streak/study plan default to empty", () => {
      expect(summary.streak).toEqual({ current: 0, lastConversationDate: null, weeklyActivity: [false, false, false, false, false, false, false] });
      expect(summary.studyPlan).toEqual({ startDate: null, completedDays: [] });
    });
    it("falls back createdAt to now", () => expect(summary.createdAt).toBe(NOW.toISOString()));
  });

  describe("onboarded", () => {
    it("is true when target_language is set, even without ai consent", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, target_language: "spanish", ai_consent_at: null } }));
      expect(summary.onboarded).toBe(true);
    });

    it("is false when the row has a null target_language", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, target_language: null } }));
      expect(summary.onboarded).toBe(false);
    });

    it("is false when there is no row at all", () => {
      const summary = buildProfileSummary(baseInput({ row: null }));
      expect(summary.onboarded).toBe(false);
    });
  });

  describe("free usage limits", () => {
    it("grants unlimited (999) usage to a pro user", () => {
      const summary = buildProfileSummary(baseInput());
      expect(summary.usage).toEqual({ freeConversationsRemaining: 999, freeGenerationsRemaining: 999 });
    });

    it("computes remaining free conversations/generations for a free user", () => {
      const summary = buildProfileSummary(
        baseInput({ row: { ...ROW, pro_status: null }, conversations: { completed: 1, avgOverallScore: 80, total: 1 }, generationEvents: 1 })
      );
      expect(summary.usage).toEqual({ freeConversationsRemaining: 2, freeGenerationsRemaining: 2 });
    });

    it("floors remaining usage at zero once the free limit is exceeded", () => {
      const summary = buildProfileSummary(
        baseInput({ row: { ...ROW, pro_status: null }, conversations: { completed: 5, avgOverallScore: 80, total: 5 }, generationEvents: 9 })
      );
      expect(summary.usage).toEqual({ freeConversationsRemaining: 0, freeGenerationsRemaining: 0 });
    });
  });

  describe("free generations count events, not surviving lessons", () => {
    it("keeps the allowance used up after the learner deletes their generated lessons", () => {
      const summary = buildProfileSummary(
        baseInput({ row: { ...ROW, pro_status: null }, generatedLessons: 0, generationEvents: 3 })
      );
      expect(summary.usage.freeGenerationsRemaining).toBe(0);
      expect(summary.stats.generatedLessons).toBe(0);
    });

    it("does not count lessons that exist without a recorded event", () => {
      const summary = buildProfileSummary(
        baseInput({ row: { ...ROW, pro_status: null }, generatedLessons: 5, generationEvents: 1 })
      );
      expect(summary.usage.freeGenerationsRemaining).toBe(2);
      expect(summary.stats.generatedLessons).toBe(5);
    });
  });

  describe("guard fallbacks for invalid stored values", () => {
    it("falls back an unrecognised user_level to beginner", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, user_level: "bogus" as never } }));
      expect(summary.level).toBe("beginner");
    });

    it("falls back an unrecognised native_language to russian", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, native_language: "klingon" } }));
      expect(summary.nativeLanguage).toBe("russian");
    });

    it("falls back an unrecognised target_language to english via getLanguage", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, target_language: "klingon" } }));
      expect(summary.targetLanguage).toBe("english");
    });

    it("falls back an unrecognised tutor_id to luna via getTutorById", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, tutor_id: "bogus" } }));
      expect(summary.tutorId).toBe("luna");
    });

    it("defaults a null daily_goal_minutes to 10", () => {
      const summary = buildProfileSummary(baseInput({ row: { ...ROW, daily_goal_minutes: null } }));
      expect(summary.dailyGoalMinutes).toBe(10);
    });
  });

  it("defaults `now` to the current time when omitted", () => {
    const summary = buildProfileSummary({
      user: { id: "u1", email: "jane@example.com" },
      row: null,
      conversations: { completed: 0, avgOverallScore: null, total: 0 },
      lessonsCompleted: 0,
      favoriteWords: 0,
      generatedLessons: 0,
      generationEvents: 0,
    });
    expect(new Date(summary.createdAt).getTime()).toBeGreaterThan(0);
  });
});
