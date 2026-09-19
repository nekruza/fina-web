import { POST } from "../route";
import { MOTIVATIONS } from "@/lib/data/onboarding";
import { createSupabaseMock, writePayload, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

const USER = { id: "user-1", email: "jane@example.com" };

const VALID_BODY = {
  tutor: "luna",
  language: "spanish",
  level: "some",
  motivation: "travel",
  goal: 10,
};

function mockSupabase(opts: {
  user?: SupabaseMockConfig["user"];
  existingProfile?: Record<string, unknown> | null;
}) {
  const { user = USER, existingProfile = null } = opts;
  const mock = createSupabaseMock({
    user,
    tables: {
      profiles: [
        { data: null, error: null }, // updateProfile
        { data: existingProfile, error: null }, // ensureStudyPlanStartDate -> getProfileRow
        { data: null, error: null }, // ensureStudyPlanStartDate -> updateProfile (if needed)
      ],
    },
  });
  createClient.mockResolvedValue(mock);
  return mock;
}

function req(body: unknown) {
  return new Request("http://localhost/api/profile/onboarding", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

describe("POST /api/profile/onboarding", () => {
  it.each(MOTIVATIONS)("maps $id to the existing database constraint", async ({ id }) => {
    const expected: Record<string, string> = {
      travel: "travel",
      work: "career",
      connect: "communication",
      media: "entertainment",
      challenge: "personal",
    };
    const mock = mockSupabase({});

    const res = await POST(req({ ...VALID_BODY, motivation: id }));

    expect(res.status).toBe(200);
    expect(expected[id]).toBeDefined();
    expect(writePayload(mock, "profiles", "update").learning_motivation).toBe(expected[id]);
  });

  it("rejects an unknown motivation before writing to the database", async () => {
    const mock = mockSupabase({});

    const res = await POST(req({ ...VALID_BODY, motivation: "unknown" }));

    expect(res.status).toBe(400);
    expect(mock.from).not.toHaveBeenCalled();
  });

  it.each(["academic", "career", "travel", "communication", "entertainment", "personal"])(
    "preserves the supported database value %s",
    async (motivation) => {
      const mock = mockSupabase({});
      const res = await POST(req({ ...VALID_BODY, motivation }));
      expect(res.status).toBe(200);
      expect(writePayload(mock, "profiles", "update").learning_motivation).toBe(motivation);
    }
  );

  it.each([0, 1, 2])("returns a safe JSON error if database operation %i fails", async (failedOperation) => {
    const databaseError = {
      code: "23514",
      message: 'new row violates check constraint "profiles_learning_motivation_check"',
      details: "Private row contents",
    };
    createClient.mockResolvedValue(createSupabaseMock({
      user: USER,
      tables: {
        profiles: [0, 1, 2].map((operation) => ({
          data: null,
          error: operation === failedOperation ? databaseError : null,
        })),
      },
    }));
    const log = jest.spyOn(console, "error").mockImplementation(() => {});
    try {
      const res = await POST(req(VALID_BODY));
      expect(res.status).toBe(500);
      await expect(res.json()).resolves.toEqual({ error: "Unable to save your plan. Please try again." });
      expect(log).toHaveBeenCalledWith("[onboarding] Profile setup failed " + JSON.stringify({
        code: databaseError.code,
        message: databaseError.message,
      }));
    } finally {
      log.mockRestore();
    }
  });

  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });

    const res = await POST(req(VALID_BODY));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });

  it("returns 400 for an invalid language", async () => {
    mockSupabase({});

    const res = await POST(req({ ...VALID_BODY, language: "klingon" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid language" });
  });

  it("returns 400 for an invalid language when the JSON body is malformed", async () => {
    mockSupabase({});
    const malformed = new Request("http://localhost/api/profile/onboarding", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }) as never;

    const res = await POST(malformed);

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid language" });
  });

  it("returns 400 for an invalid tutor", async () => {
    mockSupabase({});

    const res = await POST(req({ ...VALID_BODY, tutor: "bogus" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid tutor" });
  });

  it("returns 400 for a goal outside {5,10,20,30}", async () => {
    mockSupabase({});

    const res = await POST(req({ ...VALID_BODY, goal: 15 }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid goal" });
  });

  it("updates the existing profile without requiring the RLS insert permission used by upsert", async () => {
    const mock = mockSupabase({ existingProfile: { study_plan_start_date: "2026-08-01T00:00:00.000Z" } });

    const res = await POST(req(VALID_BODY));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });

    const payload = writePayload(mock, "profiles", "update");
    expect(payload).toMatchObject({
      user_level: "elementary",
      target_language: "spanish",
      learning_motivation: "travel",
    });
    expect(payload).not.toHaveProperty("daily_goal_minutes");
    expect(payload).not.toHaveProperty("tutor_id");
    expect(payload).not.toHaveProperty("ai_consent_at");
    expect(payload).not.toHaveProperty("ai_consent_accepted");
    expect(writePayload(mock, "profiles", "upsert")).toBeUndefined();
  });

  it("does not overwrite an existing study_plan_start_date", async () => {
    const mock = mockSupabase({ existingProfile: { study_plan_start_date: "2026-08-01T00:00:00.000Z" } });

    await POST(req(VALID_BODY));

    // Only the onboarding update should have written to `profiles`; ensureStudyPlanStartDate
    // must not issue a second update when the row already has a start date.
    const updateCalls = mock.calls.filter((c) => c.table === "profiles" && (c.builder.update as jest.Mock).mock.calls.length > 0);
    expect(updateCalls).toHaveLength(1);
  });

  it("sets study_plan_start_date to now when the existing row has none", async () => {
    const mock = mockSupabase({ existingProfile: { study_plan_start_date: null } });

    await POST(req(VALID_BODY));

    expect(writePayload(mock, "profiles", "update", 1)).toEqual(
      expect.objectContaining({ study_plan_start_date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/) })
    );
  });

  it("stores a null learning_motivation when the answer is not a string", async () => {
    const mock = mockSupabase({
      user: { id: "user-1", email: undefined },
      existingProfile: { study_plan_start_date: "2026-08-01T00:00:00.000Z" },
    });

    const res = await POST(req({ ...VALID_BODY, motivation: 123 }));

    expect(res.status).toBe(200);
    const payload = writePayload(mock, "profiles", "update");
    expect(payload).not.toHaveProperty("email");
    expect(payload.learning_motivation).toBeNull();
  });

  it("maps every onboarding level id to its UserLevel", async () => {
    const cases: [string, string][] = [
      ["beginner", "beginner"],
      ["some", "elementary"],
      ["convo", "intermediate"],
      ["fluent", "advanced"],
    ];

    for (const [onboardingLevel, userLevel] of cases) {
      const mock = mockSupabase({ existingProfile: { study_plan_start_date: "2026-08-01T00:00:00.000Z" } });
      await POST(req({ ...VALID_BODY, level: onboardingLevel }));
      expect(writePayload(mock, "profiles", "update").user_level).toBe(userLevel);
    }
  });
});
