import type { NextRequest } from "next/server";
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

/** Make the model return `text`, optionally split across chunks. */
function modelReturns(text: string, chunkSize = text.length || 1) {
  streamLLM.mockImplementation(async function* () {
    for (let i = 0; i < text.length; i += chunkSize) {
      yield text.slice(i, i + chunkSize);
    }
  });
}

function modelThrows(error: unknown) {
  streamLLM.mockImplementation(async function* () {
    throw error;
    // eslint-disable-next-line no-unreachable
    yield "";
  });
}

function feedbackRequest(body: unknown) {
  const withSession =
    body && typeof body === "object" && !("sessionId" in body) ? { sessionId: SESSION_ID, ...body } : body;
  return new Request("http://localhost/api/ai/feedback", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(withSession),
  }) as unknown as NextRequest;
}

const TRANSCRIPT = [
  { role: "user", content: "[BEGIN]" },
  { role: "assistant", content: "¡Hola! ¿Cómo te llamas?" },
  { role: "user", content: "Me llamo Ana. Vivo en Madrid." },
];

const FULL_RESULT = {
  overall: 82,
  fluency: 80,
  grammar: 75,
  vocabulary: 85,
  engagement: 90,
  relevancy: 88,
  summary: "Ana introduced herself clearly and stayed on topic throughout.",
  strengths: ["Clear self-introduction", "Good pacing"],
  corrections: [
    {
      original: "Me llamo Ana. Vivo en Madrid.",
      corrected: "Me llamo Ana y vivo en Madrid.",
      explanation: "Join short sentences with 'y' for a more natural flow.",
    },
  ],
};

beforeEach(() => {
  modelReturns(JSON.stringify(FULL_RESULT));
});

describe("authorisation", () => {
  it("allows an authenticated user", async () => {
    mockSupabase({ user: USER });

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(res.status).toBe(200);
  });

  it("returns 401 with no user", async () => {
    mockSupabase({ user: null });

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

describe("transient session handling", () => {
  it("returns 403 invalid_session without a sessionId, before calling the model", async () => {
    mockSupabase({ user: USER });

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT, sessionId: undefined }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "invalid_session" });
    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("does not query a conversation table for a transient session id", async () => {
    const mock = mockSupabase({ user: USER });

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(res.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not require a persisted session age check", async () => {
    const mock = mockSupabase({ user: USER });

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(res.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not query a missing conversation table", async () => {
    const mock = mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });
});

describe("sessions with no real learner speech", () => {
  it("returns the no-speech result when messages is missing", async () => {
    mockSupabase({ user: USER });

    const body = await (await POST(feedbackRequest({}))).json();

    expect(body).toMatchObject({
      overall: 0,
      fluency: 0,
      grammar: 0,
      vocabulary: 0,
      engagement: 0,
      relevancy: 0,
      strengths: [],
      corrections: [],
    });
    expect(body.summary).toContain("We didn't catch any speech this time");
  });

  it("returns the no-speech result when messages is not an array", async () => {
    mockSupabase({ user: USER });

    const body = await (await POST(feedbackRequest({ messages: "hello" }))).json();

    expect(body.overall).toBe(0);
  });

  it("returns the no-speech result when the learner never spoke", async () => {
    mockSupabase({ user: USER });

    const body = await (
      await POST(
        feedbackRequest({
          messages: [{ role: "assistant", content: "¡Hola!" }],
        })
      )
    ).json();

    expect(body.overall).toBe(0);
    expect(body.strengths).toEqual([]);
  });

  it("treats [BEGIN] as not a real learner message", async () => {
    mockSupabase({ user: USER });

    const body = await (
      await POST(feedbackRequest({ messages: [{ role: "user", content: "[BEGIN]" }] }))
    ).json();

    expect(body.overall).toBe(0);
  });

  it("treats [SESSION START] as not a real learner message", async () => {
    mockSupabase({ user: USER });

    const body = await (
      await POST(
        feedbackRequest({
          messages: [{ role: "user", content: "[SESSION START] hello" }],
        })
      )
    ).json();

    expect(body.overall).toBe(0);
  });

  it("does not call the model when there is nothing to grade", async () => {
    mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: [] }));

    expect(streamLLM).not.toHaveBeenCalled();
  });
});

describe("transcript construction", () => {
  it("labels the speakers Learner/Tutor for the model", async () => {
    mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: TRANSCRIPT }));

    const transcript = streamLLM.mock.calls[0][0].messages[0].content;
    expect(transcript).toContain("Tutor: ¡Hola! ¿Cómo te llamas?");
    expect(transcript).toContain("Learner: Me llamo Ana. Vivo en Madrid.");
  });

  it("excludes the [BEGIN] marker from the transcript", async () => {
    mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(streamLLM.mock.calls[0][0].messages[0].content).not.toContain("[BEGIN]");
  });

  it("appends a formatted duration line", async () => {
    mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: TRANSCRIPT, durationSeconds: 95 }));

    expect(streamLLM.mock.calls[0][0].messages[0].content).toContain("Duration: 1:35");
  });

  it("grades at a low temperature with a generous token budget", async () => {
    mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(streamLLM.mock.calls[0][0].temperature).toBe(0.3);
    expect(streamLLM.mock.calls[0][0].maxTokens).toBe(2000);
  });

  it("builds the analysis prompt for the requested language and level", async () => {
    mockSupabase({ user: USER });

    await POST(
      feedbackRequest({ messages: TRANSCRIPT, language: "spanish", level: "intermediate" })
    );

    const { systemPrompt } = streamLLM.mock.calls[0][0];
    expect(systemPrompt).toContain("Spanish");
    expect(systemPrompt).toContain("Intermediate");
  });

  it("defaults to english/beginner when language/level are missing", async () => {
    mockSupabase({ user: USER });

    await POST(feedbackRequest({ messages: TRANSCRIPT }));

    const { systemPrompt } = streamLLM.mock.calls[0][0];
    expect(systemPrompt).toContain("English");
    expect(systemPrompt).toContain("Beginner");
  });
});

describe("model output parsing", () => {
  it("returns the graded result", async () => {
    mockSupabase({ user: USER });

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body).toEqual(FULL_RESULT);
  });

  it("strips markdown fences around the JSON", async () => {
    mockSupabase({ user: USER });
    modelReturns("```json\n" + JSON.stringify(FULL_RESULT) + "\n```");

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.overall).toBe(82);
  });

  it("reassembles output split across chunks", async () => {
    mockSupabase({ user: USER });
    modelReturns(JSON.stringify(FULL_RESULT), 7);

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.overall).toBe(82);
  });

  it.each([
    [150, 100],
    [-3, 0],
    [72.4, 72],
    [72.6, 73],
  ])("clamps and rounds a score of %p to %p", async (raw, expected) => {
    mockSupabase({ user: USER });
    modelReturns(JSON.stringify({ ...FULL_RESULT, overall: raw }));

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.overall).toBe(expected);
  });

  it("caps strengths at 3", async () => {
    mockSupabase({ user: USER });
    modelReturns(
      JSON.stringify({ ...FULL_RESULT, strengths: ["a", "b", "c", "d", "e"] })
    );

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.strengths).toHaveLength(3);
  });

  it("caps corrections at 5 and coerces every field to a string", async () => {
    mockSupabase({ user: USER });
    const sevenCorrections = Array.from({ length: 7 }, (_, i) => ({
      original: `o${i}`,
      corrected: `c${i}`,
      explanation: `e${i}`,
    }));
    modelReturns(JSON.stringify({ ...FULL_RESULT, corrections: sevenCorrections }));

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.corrections).toHaveLength(5);
    expect(body.corrections[0]).toEqual({ original: "o0", corrected: "c0", explanation: "e0" });
  });

  it("allows an empty corrections list when the learner wrote correctly", async () => {
    mockSupabase({ user: USER });
    modelReturns(JSON.stringify({ ...FULL_RESULT, corrections: [] }));

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.corrections).toEqual([]);
  });

  it("returns empty lists when the model omits them", async () => {
    mockSupabase({ user: USER });
    modelReturns(JSON.stringify({ overall: 65 }));

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.strengths).toEqual([]);
    expect(body.corrections).toEqual([]);
  });
});

describe("failure handling", () => {
  it("falls back to the fallback result when the model returns invalid JSON", async () => {
    mockSupabase({ user: USER });
    modelReturns("I'm sorry, I can't do that.");

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.overall).toBe(70);
    expect(body.summary).toContain("still counts toward your streak");
  });

  it("falls back to the fallback result when the model throws", async () => {
    mockSupabase({ user: USER });
    modelThrows(new Error("Gemini timed out"));

    const body = await (await POST(feedbackRequest({ messages: TRANSCRIPT }))).json();

    expect(body.overall).toBe(70);
    expect(body.strengths).toEqual([]);
    expect(body.corrections).toEqual([]);
  });

  it("never returns a 500 to the client", async () => {
    mockSupabase({ user: USER });
    modelThrows(new Error("boom"));

    const res = await POST(feedbackRequest({ messages: TRANSCRIPT }));

    expect(res.status).toBe(200);
  });
});
