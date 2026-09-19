import { GET, PATCH } from "../route";
import { createSupabaseMock, writePayload, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

const USER = { id: "user-1", email: "jane@example.com" };

const PROFILE_ROW = {
  id: "user-1",
  email: "jane@example.com",
  display_name: "Jane",
  user_level: "intermediate",
  current_streak: 3,
  words_learned: 0,
  accuracy: 0,
  last_conversation_date: "2026-09-12",
  weekly_activity: null,
  target_language: "spanish",
  learning_motivation: "travel",
  daily_goal_minutes: 20,
  study_plan_completed_days: null,
  study_plan_start_date: "2026-09-01T00:00:00.000Z",
  native_language: "french",
  tutor_id: "henry",
  ai_consent_at: "2026-09-01T00:00:00.000Z",
  stripe_customer_id: null,
  stripe_subscription_id: null,
  pro_status: null,
  pro_current_period_end: null,
  created_at: "2026-08-01T00:00:00.000Z",
  updated_at: null,
};

function mockSupabase(opts: {
  user?: SupabaseMockConfig["user"];
  profile?: Record<string, unknown> | null;
  completedLessonIds?: { lesson_id: string }[];
  favoriteWordIds?: { word_id: string }[];
  generatedLessonsCount?: number;
}) {
  const {
    user = USER,
    profile = PROFILE_ROW,
    completedLessonIds = [],
    favoriteWordIds = [],
    generatedLessonsCount = 0,
  } = opts;

  const mock = createSupabaseMock({
    user,
    tables: {
      profiles: { data: profile, error: null },
      lesson_progress: { data: completedLessonIds, error: null },
      favorite_words: { data: favoriteWordIds, error: null },
      generated_lessons: { data: null, error: null, count: generatedLessonsCount },
    },
  });
  createClient.mockResolvedValue(mock);
  return mock;
}

function patchRequest(body: unknown) {
  return new Request("http://localhost/api/profile", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("GET /api/profile", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });

    const res = await GET();

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns the full ProfileSummary for the signed-in user", async () => {
    mockSupabase({
      completedLessonIds: [{ lesson_id: "l1" }, { lesson_id: "l2" }],
      favoriteWordIds: [{ word_id: "w1" }],
      generatedLessonsCount: 1,
    });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      id: "user-1",
      email: "jane@example.com",
      displayName: "Jane",
      level: "intermediate",
      targetLanguage: "spanish",
      nativeLanguage: "french",
      tutorId: "henry",
      dailyGoalMinutes: 20,
      onboarded: true,
      stats: { conversationsCompleted: 0, avgOverallScore: null, lessonsCompleted: 2, favoriteWords: 1, generatedLessons: 1 },
      pro: { isPro: false },
      usage: { freeConversationsRemaining: 3, freeGenerationsRemaining: 2 },
    });
  });

  it("computes free generations from the current generated lessons table", async () => {
    mockSupabase({ generatedLessonsCount: 3 });

    const res = await GET();
    const body = await res.json();

    expect(body.usage.freeGenerationsRemaining).toBe(0);
    expect(body.stats.generatedLessons).toBe(3);
  });

  it("defaults a brand-new user with no profile row", async () => {
    mockSupabase({ profile: null });

    const res = await GET();
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toMatchObject({
      displayName: "jane",
      level: "beginner",
      targetLanguage: "english",
      nativeLanguage: "russian",
      tutorId: "luna",
      dailyGoalMinutes: 10,
      onboarded: false,
      usage: { freeConversationsRemaining: 3, freeGenerationsRemaining: 3 },
    });
  });

  it("gives a pro user unlimited (999) usage regardless of consumption", async () => {
    mockSupabase({
      profile: { ...PROFILE_ROW, pro_status: "active", pro_current_period_end: null },
      generatedLessonsCount: 10,
    });

    const res = await GET();
    const body = await res.json();

    expect(body.pro.isPro).toBe(true);
    expect(body.usage).toEqual({ freeConversationsRemaining: 999, freeGenerationsRemaining: 999 });
  });
});

describe("PATCH /api/profile", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });

    const res = await PATCH(patchRequest({ displayName: "New" }));

    expect(res.status).toBe(401);
  });

  it("returns 400 'Nothing to update' for an empty body", async () => {
    mockSupabase({});

    const res = await PATCH(patchRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Nothing to update" });
  });

  it("returns 400 'Nothing to update' for a malformed JSON body", async () => {
    mockSupabase({});
    const req = new Request("http://localhost/api/profile", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }) as never;

    const res = await PATCH(req);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Nothing to update" });
  });

  it("updates displayName with snake_case keys", async () => {
    const mock = mockSupabase({});

    const res = await PATCH(patchRequest({ displayName: "  New Name  " }));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    expect(writePayload(mock, "profiles", "update")).toEqual({ display_name: "New Name" });
  });

  it("rejects an empty displayName", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ displayName: "   " }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid displayName" });
  });

  it("rejects a displayName over 100 chars", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ displayName: "a".repeat(101) }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid displayName" });
  });

  it("rejects an invalid level", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ level: "bogus" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid level" });
  });

  it("rejects an invalid targetLanguage", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ targetLanguage: "klingon" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid targetLanguage" });
  });

  it("does not persist nativeLanguage because it is a local preference", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ nativeLanguage: "english" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Nothing to update" });
  });

  it("does not persist dailyGoalMinutes because it is a local preference", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ dailyGoalMinutes: 15 }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Nothing to update" });
  });

  it("does not persist tutorId because it is a local preference", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ tutorId: "jake" }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Nothing to update" });
  });

  it("stops at the first invalid field", async () => {
    mockSupabase({});
    const res = await PATCH(patchRequest({ level: "bogus", tutorId: "also-bogus" }));
    await expect(res.json()).resolves.toEqual({ error: "Invalid level" });
  });

  it("updates multiple valid fields in one call", async () => {
    const mock = mockSupabase({});

    const res = await PATCH(
      patchRequest({ level: "advanced", targetLanguage: "japanese", nativeLanguage: "english", dailyGoalMinutes: 30, tutorId: "jake" })
    );

    expect(res.status).toBe(200);
    expect(writePayload(mock, "profiles", "update")).toEqual({
      user_level: "advanced",
      target_language: "japanese",
    });
  });
});
