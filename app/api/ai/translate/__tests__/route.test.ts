import type { NextRequest } from "next/server";
import { POST } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/llm", () => ({ streamLLM: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");
const { streamLLM } = jest.requireMock("@/lib/llm");

const USER = { id: "user-1" };

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

function translateRequest(body: unknown) {
  return new Request("http://localhost/api/ai/translate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

beforeEach(() => {
  streamsChunks(["Hola"]);
});

describe("authorisation", () => {
  it("allows an authenticated user", async () => {
    mockSupabase({ user: USER });

    const res = await POST(translateRequest({ text: "Hello", targetLanguage: "spanish" }));

    expect(res.status).toBe(200);
  });

  it("returns 401 with no user", async () => {
    mockSupabase({ user: null });

    const res = await POST(translateRequest({ text: "Hello", targetLanguage: "spanish" }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
  });
});

describe("validation", () => {
  it("returns 400 when text is missing", async () => {
    mockSupabase({ user: USER });

    const res = await POST(translateRequest({ targetLanguage: "spanish" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when text is empty", async () => {
    mockSupabase({ user: USER });

    const res = await POST(translateRequest({ text: "", targetLanguage: "spanish" }));

    expect(res.status).toBe(400);
  });

  it("returns 400 when text exceeds 1000 characters", async () => {
    mockSupabase({ user: USER });

    const res = await POST(
      translateRequest({ text: "a".repeat(1001), targetLanguage: "spanish" })
    );

    expect(res.status).toBe(400);
  });

  it("accepts text right at the 1000 character boundary", async () => {
    mockSupabase({ user: USER });

    const res = await POST(
      translateRequest({ text: "a".repeat(1000), targetLanguage: "spanish" })
    );

    expect(res.status).toBe(200);
  });

  it("does not call the model when validation fails", async () => {
    mockSupabase({ user: USER });

    await POST(translateRequest({ targetLanguage: "spanish" }));

    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("defaults to english when targetLanguage is missing or invalid", async () => {
    mockSupabase({ user: USER });

    await POST(translateRequest({ text: "Hello", targetLanguage: "klingon" }));

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain("into American English");
  });
});

describe("happy path", () => {
  it("translates the text into the requested language", async () => {
    mockSupabase({ user: USER });

    const res = await POST(translateRequest({ text: "Hello", targetLanguage: "spanish" }));

    await expect(res.json()).resolves.toEqual({ translation: "Hola" });
  });

  it("briefs the model to translate only, without quotes or notes", async () => {
    mockSupabase({ user: USER });

    await POST(translateRequest({ text: "Hello", targetLanguage: "spanish" }));

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain(
      "You are a translator. Translate the user's text into Spanish. Reply with the translation only, no quotes or notes."
    );
  });

  it("sends the source text as the user message", async () => {
    mockSupabase({ user: USER });

    await POST(translateRequest({ text: "Hello there", targetLanguage: "spanish" }));

    expect(streamLLM.mock.calls[0][0].messages).toEqual([
      { role: "user", content: "Hello there" },
    ]);
  });

  it("uses a low temperature and a short token budget", async () => {
    mockSupabase({ user: USER });

    await POST(translateRequest({ text: "Hello", targetLanguage: "spanish" }));

    expect(streamLLM.mock.calls[0][0].maxTokens).toBe(400);
    expect(streamLLM.mock.calls[0][0].temperature).toBe(0.3);
  });

  it("trims whitespace around the translation", async () => {
    mockSupabase({ user: USER });
    streamsChunks(["  Hola ", " amigo  "]);

    const res = await POST(translateRequest({ text: "Hello friend", targetLanguage: "spanish" }));

    await expect(res.json()).resolves.toEqual({ translation: "Hola  amigo" });
  });
});

describe("failure handling", () => {
  it("returns 500 when the model throws", async () => {
    mockSupabase({ user: USER });
    streamsThenThrows([], new Error("Gemini timed out"));

    const res = await POST(translateRequest({ text: "Hello", targetLanguage: "spanish" }));

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Translation failed" });
  });
});
