import { GET, POST, PATCH } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

// Pass-through spies: the real helpers run, but tests can read the arguments
// the route hands them and override the free-tier count.
jest.mock("@/lib/db/conversations", () => {
  const actual = jest.requireActual("@/lib/db/conversations");
  return {
    ...actual,
    countConversations: jest.fn(actual.countConversations),
    completeConversation: jest.fn(actual.completeConversation),
    listConversations: jest.fn(actual.listConversations),
  };
});

const { createClient } = jest.requireMock("@/lib/supabase/server");
const { countConversations, completeConversation, listConversations } = jest.requireMock("@/lib/db/conversations");

const USER = { id: "user-1", email: "jane@example.com" };

const VALID_CREATE_BODY = {
  roleplayId: "coffee-shop-1",
  roleplayTitle: "Ordering coffee",
  tutorId: "luna",
  language: "spanish",
  level: "beginner",
};

function mockSupabase(opts: { user?: SupabaseMockConfig["user"]; profile?: Record<string, unknown> | null } = {}) {
  const { user = USER, profile = { pro_status: null, pro_current_period_end: null } } = opts;
  const mock = createSupabaseMock({
    user,
    tables: { profiles: { data: profile, error: null } },
  });
  createClient.mockResolvedValue(mock);
  return mock;
}

function postReq(body: unknown) {
  return new Request("http://localhost/api/conversations", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function patchReq(body: unknown) {
  return new Request("http://localhost/api/conversations", {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as never;
}

function getReq(query = "") {
  return new Request(`http://localhost/api/conversations${query}`) as never;
}

describe("POST /api/conversations", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    const res = await POST(postReq(VALID_CREATE_BODY));
    expect(res.status).toBe(401);
  });

  it.each([
    ["missing roleplayId", { ...VALID_CREATE_BODY, roleplayId: "" }],
    ["missing roleplayTitle", { ...VALID_CREATE_BODY, roleplayTitle: "" }],
    ["title over 120 chars", { ...VALID_CREATE_BODY, roleplayTitle: "a".repeat(121) }],
    ["invalid tutorId", { ...VALID_CREATE_BODY, tutorId: "bogus" }],
    ["invalid language", { ...VALID_CREATE_BODY, language: "klingon" }],
    ["invalid level", { ...VALID_CREATE_BODY, level: "bogus" }],
  ])("returns 400 'Missing required fields' for %s", async (_label, body) => {
    mockSupabase();
    const res = await POST(postReq(body));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required fields" });
  });

  it("creates a transient session id without querying a conversation table", async () => {
    const mock = mockSupabase();

    const res = await POST(postReq(VALID_CREATE_BODY));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.sessionId).toEqual(expect.any(String));
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("returns 400 for a malformed JSON body", async () => {
    mockSupabase();
    const req = new Request("http://localhost/api/conversations", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: "not json",
    }) as never;

    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 403 limit_reached once a free user has used every free conversation", async () => {
    mockSupabase();
    countConversations.mockResolvedValueOnce(3);

    const res = await POST(postReq(VALID_CREATE_BODY));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "limit_reached" });
  });

  it("lets a Pro user past the free conversation limit", async () => {
    mockSupabase({ profile: { pro_status: "active", pro_current_period_end: null } });
    countConversations.mockResolvedValueOnce(10);

    const res = await POST(postReq(VALID_CREATE_BODY));

    expect(res.status).toBe(200);
  });
});

describe("PATCH /api/conversations", () => {
  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(2026, 8, 13, 10));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    const res = await PATCH(patchReq({ sessionId: "s1", messageCount: 4 }));
    expect(res.status).toBe(401);
  });

  it("returns 400 when the transient session id is absent", async () => {
    mockSupabase();
    const res = await PATCH(patchReq({ messageCount: 4 }));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required fields" });
  });

  it("updates the durable profile streak without writing conversation details", async () => {
    const mock = mockSupabase({ profile: { current_streak: 0, last_conversation_date: null, weekly_activity: null } });

    const res = await PATCH(
      patchReq({
        sessionId: "s1",
        durationSeconds: 90,
        messageCount: 4,
        localDate: "2026-09-13",
        dayOfWeek: 0,
        analysis: { overall: 85 },
      })
    );

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      ok: true,
      streak: { current: 1, weeklyActivity: [true, false, false, false, false, false, false], lastConversationDate: "2026-09-13" },
    });
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
    expect(mock.calls.filter((c) => c.table === "profiles" && (c.builder.update as jest.Mock).mock.calls.length > 0)).toHaveLength(1);
  });

  it("does not update the streak for a silent session", async () => {
    const mock = mockSupabase({ profile: { current_streak: 2, last_conversation_date: "2026-09-12", weekly_activity: null } });

    const res = await PATCH(
      patchReq({ sessionId: "s1", durationSeconds: 10, messageCount: 0, localDate: "2026-09-13", dayOfWeek: 0 })
    );

    expect(res.status).toBe(200);
    expect(mock.calls.filter((c) => c.table === "profiles" && (c.builder.update as jest.Mock).mock.calls.length > 0)).toHaveLength(0);
  });

  it("sanitizes the analysis: clamps scores, caps lists, and stringifies fields", async () => {
    mockSupabase({ profile: null });

    await PATCH(
      patchReq({
        sessionId: "s1",
        messageCount: 2,
        analysis: {
          overall: 150,
          fluency: -5,
          grammar: "not a number",
          vocabulary: 70,
          engagement: 60,
          relevancy: 50,
          summary: 42,
          strengths: ["a", "b", "c", "d"],
          corrections: [null, { original: "goed", corrected: "went", explanation: "irregular" }, {}, {}, {}, {}],
        },
      })
    );

    const analysis = completeConversation.mock.calls[0][3].analysis;
    expect(analysis).toMatchObject({ overall: 100, fluency: 0, grammar: 0, vocabulary: 70, summary: "" });
    expect(analysis.strengths).toEqual(["a", "b", "c"]);
    expect(analysis.corrections).toHaveLength(5);
    expect(analysis.corrections[0]).toEqual({ original: "", corrected: "", explanation: "" });
    expect(analysis.corrections[1]).toEqual({ original: "goed", corrected: "went", explanation: "irregular" });
  });

  it("keeps a string summary and defaults missing lists to empty", async () => {
    mockSupabase();

    await PATCH(patchReq({ sessionId: "s1", analysis: { summary: "Nice work" } }));

    expect(completeConversation.mock.calls[0][3].analysis).toMatchObject({
      summary: "Nice work",
      strengths: [],
      corrections: [],
    });
  });

  it.each([
    ["an array", [1, 2]],
    ["a string", "great"],
    ["null", null],
  ])("drops an analysis that is %s", async (_label, analysis) => {
    mockSupabase();

    await PATCH(patchReq({ sessionId: "s1", analysis }));

    expect(completeConversation.mock.calls[0][3].analysis).toBeNull();
  });

  it("coerces non-numeric duration and message counts to zero", async () => {
    mockSupabase();

    await PATCH(patchReq({ sessionId: "s1", durationSeconds: "abc", messageCount: "xyz" }));

    expect(completeConversation.mock.calls[0][3]).toMatchObject({ durationSeconds: 0, messageCount: 0 });
  });

  it("falls back to the server date and weekday when the client sends invalid ones", async () => {
    mockSupabase({ profile: null });

    const res = await PATCH(
      patchReq({ sessionId: "s1", messageCount: 3, localDate: "13/09/2026", dayOfWeek: 9 })
    );

    // Fake time is Sunday 2026-09-13, so the server-side fallback marks index 0.
    await expect(res.json()).resolves.toEqual({
      ok: true,
      streak: { current: 1, weeklyActivity: [true, false, false, false, false, false, false], lastConversationDate: "2026-09-13" },
    });
  });

  it("does not rewrite the streak when today was already counted", async () => {
    const mock = mockSupabase({
      profile: { current_streak: 4, last_conversation_date: "2026-09-13", weekly_activity: null },
    });

    const res = await PATCH(patchReq({ sessionId: "s1", messageCount: 5, localDate: "2026-09-13", dayOfWeek: 0 }));

    expect((await res.json()).streak.current).toBe(4);
    expect(mock.calls.filter((c) => c.table === "profiles" && (c.builder.update as jest.Mock).mock.calls.length > 0)).toHaveLength(0);
  });
});

describe("GET /api/conversations", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    const res = await GET(getReq());
    expect(res.status).toBe(401);
  });

  it("returns an empty history without querying a missing conversation table", async () => {
    const mock = mockSupabase();

    const res = await GET(getReq("?limit=50"));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ sessions: [] });
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it.each([
    ["no limit", "", 20],
    ["a non-numeric limit", "?limit=abc", 20],
    ["a limit above 50", "?limit=500", 50],
    ["a limit below 1", "?limit=0", 1],
  ])("clamps %s to %i", async (_label, query, expected) => {
    mockSupabase();

    await GET(getReq(query));

    expect(listConversations).toHaveBeenCalledWith(expect.anything(), USER.id, expected);
  });
});
