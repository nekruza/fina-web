import { GET, POST, PATCH } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

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
});
