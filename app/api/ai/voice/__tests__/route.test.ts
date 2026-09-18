import { POST } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/llm", () => ({ streamLLM: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");
const { streamLLM } = jest.requireMock("@/lib/llm");

const USER = { id: "user-1" };

const SESSION_ID = "session-1";

function mockSupabase(config: SupabaseMockConfig) {
  const mock = createSupabaseMock(config);
  createClient.mockResolvedValue(mock);
  return mock;
}

function streamsChunks(chunks: string[]) {
  streamLLM.mockImplementation(async function* () {
    for (const chunk of chunks) yield chunk;
  });
}

function streamsThenThrows(chunks: string[], error: unknown) {
  streamLLM.mockImplementation(async function* () {
    for (const chunk of chunks) yield chunk;
    throw error;
  });
}

function voiceRequest(body: unknown) {
  const withSession =
    body && typeof body === "object" && !("sessionId" in body) ? { sessionId: SESSION_ID, ...body } : body;
  return new Request("http://localhost/api/ai/voice", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSession),
  });
}

const TURN = {
  messages: [{ role: "user", content: "[BEGIN]" }],
  language: "spanish",
  level: "intermediate",
  tutorId: "luna",
};

beforeEach(() => {
  streamsChunks(["Hola", " amigo"]);
});

describe("authorisation", () => {
  it("allows an authenticated user", async () => {
    mockSupabase({ user: USER });

    const res = await POST(voiceRequest(TURN));

    expect(res.status).toBe(200);
  });

  it("returns 401 with no user", async () => {
    mockSupabase({ user: null });

    const res = await POST(voiceRequest(TURN));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

describe("validation", () => {
  it("returns 400 when messages is missing", async () => {
    mockSupabase({ user: USER });

    const res = await POST(voiceRequest({ language: "english" }));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing required fields" });
  });

  it("returns 400 when messages is not an array", async () => {
    mockSupabase({ user: USER });

    const res = await POST(voiceRequest({ messages: "hi" }));

    expect(res.status).toBe(400);
  });

  it("does not call the model when validation fails", async () => {
    mockSupabase({ user: USER });

    await POST(voiceRequest({}));

    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("defaults to english when language is missing or invalid", async () => {
    mockSupabase({ user: USER });

    await (await POST(voiceRequest({ ...TURN, language: "klingon" }))).text();

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain(
      "Speak ONLY in English."
    );
  });

  it("defaults to beginner when level is missing or invalid", async () => {
    mockSupabase({ user: USER });

    await (await POST(voiceRequest({ ...TURN, level: "expert" }))).text();

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain(
      "LEARNER LEVEL: Beginner"
    );
  });
});

describe("conversation turn", () => {
  it("responds as a server-sent event stream", async () => {
    mockSupabase({ user: USER });

    const res = await POST(voiceRequest(TURN));

    expect(res.headers.get("Content-Type")).toBe("text/event-stream");
  });

  it("emits each chunk and a DONE sentinel", async () => {
    mockSupabase({ user: USER });

    const body = await (await POST(voiceRequest(TURN))).text();

    expect(body).toContain('data: {"text":"Hola"}');
    expect(body).toContain('data: {"text":" amigo"}');
    expect(body.trimEnd().endsWith("data: [DONE]")).toBe(true);
  });

  it("keeps spoken replies short", async () => {
    mockSupabase({ user: USER });

    await (await POST(voiceRequest(TURN))).text();

    expect(streamLLM.mock.calls[0][0].maxTokens).toBe(300);
    expect(streamLLM.mock.calls[0][0].temperature).toBe(0.7);
  });

  it("passes the conversation history to the model", async () => {
    mockSupabase({ user: USER });

    await (await POST(voiceRequest(TURN))).text();

    expect(streamLLM.mock.calls[0][0].messages).toEqual(TURN.messages);
  });

  it("uses the tutor's name and the requested language/level in the system prompt", async () => {
    mockSupabase({ user: USER });

    await (await POST(voiceRequest(TURN))).text();

    const { systemPrompt } = streamLLM.mock.calls[0][0];
    expect(systemPrompt).toContain("Your name is Luna.");
    expect(systemPrompt).toContain("Speak ONLY in Spanish.");
    expect(systemPrompt).toContain("LEARNER LEVEL: Intermediate");
  });

  it("stays in character for a roleplay other than general", async () => {
    mockSupabase({ user: USER });

    await (
      await POST(
        voiceRequest({
          ...TURN,
          roleplay: {
            title: "Ordering at Restaurant",
            userRole: "Customer",
            aiRole: "Waiter",
            scenario: "A customer orders food from a waiter",
          },
        })
      )
    ).text();

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain(
      "You are playing Waiter"
    );
  });

  it("uses general-mode wording for the general roleplay (aiRole AI)", async () => {
    mockSupabase({ user: USER });

    await (
      await POST(
        voiceRequest({
          ...TURN,
          roleplay: { title: "General", userRole: "You", aiRole: "AI", scenario: "..." },
        })
      )
    ).text();

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain(
      "friendly Spanish conversation partner"
    );
  });

  it("reports a model failure in-band with a generic message, logging the provider detail server-side", async () => {
    mockSupabase({ user: USER });
    streamsThenThrows([], new Error("Gemini timed out: key sk-live-123 rejected"));

    const res = await POST(voiceRequest(TURN));
    const body = await res.text();

    expect(res.status).toBe(200);
    expect(body).toContain('data: {"error":"AI service error"}');
    expect(body).not.toContain("Gemini timed out");
    expect(body).not.toContain("[DONE]");
    expect(console.error).toHaveBeenCalledWith(
      "[ai/voice] stream error:",
      expect.objectContaining({ message: "Gemini timed out: key sk-live-123 rejected" })
    );
  });

  it("keeps chunks emitted before the failure", async () => {
    mockSupabase({ user: USER });
    streamsThenThrows(["Partial"], new Error("boom"));

    const body = await (await POST(voiceRequest(TURN))).text();

    expect(body).toContain('data: {"text":"Partial"}');
    expect(body).toContain('data: {"error":"AI service error"}');
    expect(body).not.toContain("boom");
  });

  it("falls back to a generic message for a non-Error throw", async () => {
    mockSupabase({ user: USER });
    streamsThenThrows([], "boom");

    const body = await (await POST(voiceRequest(TURN))).text();

    expect(body).toContain('data: {"error":"AI service error"}');
  });
});

describe("message caps", () => {
  it("keeps only the last 40 messages", async () => {
    mockSupabase({ user: USER });
    const messages = Array.from({ length: 50 }, (_, i) => ({ role: i % 2 ? "assistant" : "user", content: `m${i}` }));

    await (await POST(voiceRequest({ ...TURN, messages }))).text();

    const sent = streamLLM.mock.calls[0][0].messages;
    expect(sent).toHaveLength(40);
    expect(sent[0].content).toBe("m10");
    expect(sent[39].content).toBe("m49");
  });

  it("truncates each message to 4000 characters rather than rejecting it", async () => {
    mockSupabase({ user: USER });
    const long = "a".repeat(5000);

    const res = await POST(voiceRequest({ ...TURN, messages: [{ role: "user", content: long }] }));
    await res.text();

    expect(res.status).toBe(200);
    expect(streamLLM.mock.calls[0][0].messages[0].content).toHaveLength(4000);
  });

  it("caps the history the hint prompt is built from as well", async () => {
    mockSupabase({ user: USER });
    streamsChunks([JSON.stringify({ hints: ["a"] })]);
    const long = "b".repeat(5000);

    await POST(voiceRequest({ ...TURN, isHint: true, messages: [{ role: "assistant", content: long }] }));

    const transcript = streamLLM.mock.calls[0][0].messages[0].content as string;
    expect(transcript).toBe(`Tutor: ${"b".repeat(4000)}`);
  });
});

describe("transient session handling", () => {
  it("returns 403 invalid_session without a sessionId, before calling the model", async () => {
    mockSupabase({ user: USER });

    const res = await POST(voiceRequest({ ...TURN, sessionId: undefined }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "invalid_session" });
    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("does not query a conversation table for a transient session id", async () => {
    const mock = mockSupabase({ user: USER });

    const res = await POST(voiceRequest(TURN));

    expect(res.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not require a persisted session age check", async () => {
    const mock = mockSupabase({ user: USER });

    const res = await POST(voiceRequest(TURN));

    expect(res.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("allows hint requests with the transient session id", async () => {
    mockSupabase({ user: USER });

    const res = await POST(voiceRequest({ ...TURN, isHint: true }));

    expect(res.status).toBe(200);
    expect(streamLLM).toHaveBeenCalled();
  });

  it("does not query a missing conversation table", async () => {
    const mock = mockSupabase({ user: USER });

    await (await POST(voiceRequest(TURN))).text();

    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });
});

describe("hint mode", () => {
  const HINT_REQUEST = { ...TURN, isHint: true };

  function hintResponse(hints: string[]) {
    streamsChunks([JSON.stringify({ hints })]);
  }

  it("returns plain JSON with up to 4 hints, not a stream", async () => {
    mockSupabase({ user: USER });
    hintResponse(["¿Cómo estás?", "Me llamo Ana.", "¿Qué haces?", "Me gusta el café."]);

    const res = await POST(voiceRequest(HINT_REQUEST));

    expect(res.headers.get("Content-Type")).toBe("application/json");
    await expect(res.json()).resolves.toEqual({
      hints: ["¿Cómo estás?", "Me llamo Ana.", "¿Qué haces?", "Me gusta el café."],
    });
  });

  it("uses the hint prompt for the target language", async () => {
    mockSupabase({ user: USER });
    hintResponse(["a", "b", "c", "d"]);

    await POST(voiceRequest(HINT_REQUEST));

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain("Spanish learner");
  });

  it("sends the last 6 non-[BEGIN] messages as Learner/Tutor transcript", async () => {
    mockSupabase({ user: USER });
    hintResponse(["a", "b", "c", "d"]);

    await POST(
      voiceRequest({
        ...HINT_REQUEST,
        messages: [
          { role: "user", content: "[BEGIN]" },
          { role: "assistant", content: "¡Hola! ¿Cómo te llamas?" },
          { role: "user", content: "Me llamo Ana." },
        ],
      })
    );

    const transcript = streamLLM.mock.calls[0][0].messages[0].content;
    expect(transcript).not.toContain("[BEGIN]");
    expect(transcript).toContain("Tutor: ¡Hola! ¿Cómo te llamas?");
    expect(transcript).toContain("Learner: Me llamo Ana.");
  });

  it("allows a longer, warmer budget than a spoken turn", async () => {
    mockSupabase({ user: USER });
    hintResponse(["a", "b", "c", "d"]);

    await POST(voiceRequest(HINT_REQUEST));

    expect(streamLLM.mock.calls[0][0].maxTokens).toBe(400);
    expect(streamLLM.mock.calls[0][0].temperature).toBe(0.8);
  });

  it("caps hints at 4, trims them, and drops empty ones", async () => {
    mockSupabase({ user: USER });
    hintResponse(["  one  ", "two", "", "three", "four", "five"]);

    const res = await POST(voiceRequest(HINT_REQUEST));

    await expect(res.json()).resolves.toEqual({
      hints: ["one", "two", "three", "four"],
    });
  });

  it("strips markdown fences around the JSON", async () => {
    mockSupabase({ user: USER });
    streamsChunks(["```json\n" + JSON.stringify({ hints: ["a", "b", "c", "d"] }) + "\n```"]);

    const res = await POST(voiceRequest(HINT_REQUEST));

    await expect(res.json()).resolves.toEqual({ hints: ["a", "b", "c", "d"] });
  });

  it("falls back to the fixed English hints when the model returns garbage", async () => {
    mockSupabase({ user: USER });
    streamsChunks(["not json at all"]);

    const res = await POST(voiceRequest(HINT_REQUEST));

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      hints: [
        "Can you explain that in more detail?",
        "That's interesting! Can you give me an example?",
        "I understand. What else should I know?",
        "Thanks! How can I practice this?",
      ],
    });
  });

  it("falls back to the fixed hints when the model throws", async () => {
    mockSupabase({ user: USER });
    streamsThenThrows([], new Error("Gemini timed out"));

    const res = await POST(voiceRequest(HINT_REQUEST));

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.hints).toHaveLength(4);
  });
});
