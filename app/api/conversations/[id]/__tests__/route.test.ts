import { GET, PUT, DELETE } from "../route";
import {
  createSupabaseMock,
  writePayload,
  type QueryResult,
  type SupabaseMockConfig,
} from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

const USER = { id: "user-1", email: "jane@example.com" };
const ID = "11111111-1111-4111-8111-111111111111";

const MESSAGES = [
  { role: "user", content: "[BEGIN]" },
  { role: "assistant", content: "¡Hola! ¿Qué te pongo?" },
  { role: "user", content: "Un café, por favor" },
];

const VALID_BODY = {
  roleplayId: "coffee-shop-1",
  roleplayTitle: "Ordering coffee",
  tutorId: "luna",
  language: "spanish",
  level: "beginner",
  durationSeconds: 95.6,
  messages: MESSAGES,
};

function mockSupabase(
  opts: {
    user?: SupabaseMockConfig["user"];
    saveTranscripts?: boolean | null;
    saved?: QueryResult;
  } = {}
) {
  const { user = USER, saveTranscripts = true, saved = { data: null, error: null } } = opts;
  const mock = createSupabaseMock({
    user,
    tables: {
      profiles: { data: { id: USER.id, save_transcripts: saveTranscripts }, error: null },
      saved_conversations: saved,
    },
  });
  createClient.mockResolvedValue(mock);
  return mock;
}

const params = (id = ID) => ({ params: Promise.resolve({ id }) });

function putReq(body: unknown) {
  return new Request(`http://localhost/api/conversations/${ID}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as never;
}

const req = () => new Request(`http://localhost/api/conversations/${ID}`) as never;

beforeEach(() => jest.spyOn(console, "error").mockImplementation(() => {}));
afterEach(() => jest.restoreAllMocks());

describe("PUT /api/conversations/[id]", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    expect((await PUT(putReq(VALID_BODY), params())).status).toBe(401);
  });

  it("rejects an id that isn't a UUID", async () => {
    mockSupabase();
    const res = await PUT(putReq(VALID_BODY), params("not-a-uuid"));
    expect(res.status).toBe(400);
  });

  it.each([
    ["malformed JSON", "{"],
    ["missing roleplayId", { ...VALID_BODY, roleplayId: "" }],
    ["over-long roleplayTitle", { ...VALID_BODY, roleplayTitle: "x".repeat(201) }],
    ["bad tutor", { ...VALID_BODY, tutorId: "nobody" }],
    ["bad language", { ...VALID_BODY, language: "klingon" }],
    ["bad level", { ...VALID_BODY, level: "wizard" }],
    ["bad messages", { ...VALID_BODY, messages: [{ role: "system", content: "x" }] }],
    ["missing messages", { ...VALID_BODY, messages: undefined }],
  ])("returns 400 for %s", async (_label, body) => {
    const mock = mockSupabase();
    const res = await PUT(putReq(body), params());
    expect(res.status).toBe(400);
    expect(mock.callCountFor("saved_conversations")).toBe(0);
  });

  it.each([false, null])("refuses to save when the learner has saving off (%p)", async (value) => {
    const mock = mockSupabase({ saveTranscripts: value });

    const res = await PUT(putReq(VALID_BODY), params());

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "saving_off" });
    expect(mock.callCountFor("saved_conversations")).toBe(0);
  });

  it("saves the cleaned transcript for the signed-in user", async () => {
    const mock = mockSupabase();

    const res = await PUT(putReq(VALID_BODY), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ ok: true });
    const payload = writePayload(mock, "saved_conversations", "upsert");
    expect(payload).toMatchObject({
      id: ID,
      user_id: USER.id,
      roleplay_id: "coffee-shop-1",
      tutor_id: "luna",
      duration_seconds: 96,
      message_count: 1,
      messages: [
        { role: "assistant", content: "¡Hola! ¿Qué te pongo?" },
        { role: "user", content: "Un café, por favor" },
      ],
    });
    expect(payload).not.toHaveProperty("analysis");
  });

  it("stores a sanitized analysis when one is sent, and null when it is null", async () => {
    const withAnalysis = mockSupabase();
    await PUT(
      putReq({ ...VALID_BODY, analysis: { overall: 140, corrections: [{ original: "a", corrected: "b" }] } }),
      params()
    );
    expect(writePayload(withAnalysis, "saved_conversations", "upsert").analysis).toMatchObject({
      overall: 100,
      corrections: [{ original: "a", corrected: "b", explanation: "" }],
    });

    const nulled = mockSupabase();
    await PUT(putReq({ ...VALID_BODY, analysis: null }), params());
    expect(writePayload(nulled, "saved_conversations", "upsert").analysis).toBeNull();
  });

  it("treats a negative or missing duration as zero", async () => {
    const mock = mockSupabase();
    await PUT(putReq({ ...VALID_BODY, durationSeconds: -4 }), params());
    expect(writePayload(mock, "saved_conversations", "upsert").duration_seconds).toBe(0);
  });

  it("returns 500 when the database write fails", async () => {
    mockSupabase({ saved: { error: { message: "rls" } } });
    const res = await PUT(putReq(VALID_BODY), params());
    expect(res.status).toBe(500);
  });
});

describe("GET /api/conversations/[id]", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    expect((await GET(req(), params())).status).toBe(401);
  });

  it("returns 404 for a bad id or someone else's conversation", async () => {
    mockSupabase();
    expect((await GET(req(), params("nope"))).status).toBe(404);
    expect((await GET(req(), params())).status).toBe(404);
  });

  it("returns the saved conversation", async () => {
    mockSupabase({
      saved: {
        data: {
          id: ID,
          roleplay_id: "r1",
          roleplay_title: "Ordering coffee",
          tutor_id: "luna",
          language: "spanish",
          level: "beginner",
          duration_seconds: 60,
          message_count: 1,
          analysis: null,
          messages: [{ role: "user", content: "Hola" }],
          created_at: "2026-11-09T10:00:00.000Z",
          updated_at: "2026-11-09T10:01:00.000Z",
        },
        error: null,
      },
    });

    const res = await GET(req(), params());

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toMatchObject({
      conversation: { id: ID, roleplayTitle: "Ordering coffee", messages: [{ role: "user", content: "Hola" }] },
    });
  });

  it("returns 500 when the read fails", async () => {
    mockSupabase({ saved: { error: { message: "boom" } } });
    expect((await GET(req(), params())).status).toBe(500);
  });
});

describe("DELETE /api/conversations/[id]", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    expect((await DELETE(req(), params())).status).toBe(401);
  });

  it("returns 404 for an id that isn't a UUID", async () => {
    mockSupabase();
    expect((await DELETE(req(), params("nope"))).status).toBe(404);
  });

  it("deletes the user's conversation", async () => {
    const mock = mockSupabase();

    const res = await DELETE(req(), params());

    expect(res.status).toBe(200);
    const b = mock.builderFor("saved_conversations");
    expect(b.delete).toHaveBeenCalled();
    expect(b.eq).toHaveBeenCalledWith("user_id", USER.id);
  });

  it("returns 500 when the delete fails", async () => {
    mockSupabase({ saved: { error: { message: "boom" } } });
    expect((await DELETE(req(), params())).status).toBe(500);
  });
});
