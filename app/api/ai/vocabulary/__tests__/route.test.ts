import type { NextRequest } from "next/server";
import { POST } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/llm", () => ({ streamLLM: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");
const { streamLLM } = jest.requireMock("@/lib/llm");

const USER = { id: "user-1" };
const WORD = {
  word: "hola",
  definition: "hello",
  example: "¡Hola!",
  pronunciation: "ˈo.la",
  partOfSpeech: "interjection",
  difficulty: "easy",
  category: "greetings",
};
const PROFILE_ROW = {
  id: "user-1",
  target_language: "spanish",
  user_level: "beginner",
  pro_status: null,
  pro_current_period_end: null,
};

function mockSupabase(config: SupabaseMockConfig) {
  const mock = createSupabaseMock(config);
  createClient.mockResolvedValue(mock);
  return mock;
}

function modelReturns(text: string) {
  streamLLM.mockImplementation(async function* () {
    yield text;
  });
}

function modelThrows(error: unknown) {
  streamLLM.mockImplementation(async function* () {
    throw error;
    // eslint-disable-next-line no-unreachable
    yield "";
  });
}

function vocabRequest(body: unknown) {
  return new Request("http://localhost/api/ai/vocabulary", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

function baseTables(overrides: Record<string, unknown> = {}) {
  return {
    profiles: { data: PROFILE_ROW, error: null },
    generated_lessons: [
      { data: null, error: { code: "PGRST116", message: "no rows" } },
      { data: null, error: null, count: 0 },
      { data: { id: "new-id" }, error: null },
    ],
    ...overrides,
  };
}

beforeEach(() => {
  modelReturns(JSON.stringify([WORD]));
});

describe("authorisation and validation", () => {
  it("returns 401 with no user", async () => {
    mockSupabase({ user: null });
    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));
    expect(res.status).toBe(401);
  });

  it.each([
    [{ topic: "a", difficulty: "easy" }],
    [{ topic: "greetings", difficulty: "extreme" }],
    [{ difficulty: "easy" }],
  ])("rejects invalid request %p without calling the model", async (body) => {
    mockSupabase({ user: USER, tables: baseTables() });
    const res = await POST(vocabRequest(body));
    expect(res.status).toBe(400);
    expect(streamLLM).not.toHaveBeenCalled();
  });
});

describe("existing lesson reuse", () => {
  it("returns the existing lesson and skips generation usage checks", async () => {
    const existingLesson = { id: "existing-id", vocabularyWords: [], supabaseId: "row-1" };
    const mock = mockSupabase({
      user: USER,
      tables: baseTables({ generated_lessons: { data: { id: "row-1", lesson_data: existingLesson }, error: null } }),
    });

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reused).toBe(true);
    expect(body.lesson.supabaseId).toBe("row-1");
    expect(streamLLM).not.toHaveBeenCalled();
    expect(mock.callCountFor("vocabulary_generation_events")).toBe(0);
  });
});

describe("current generated_lessons allowance", () => {
  it("returns 403 at the free generation cap", async () => {
    mockSupabase({
      user: USER,
      tables: baseTables({
        generated_lessons: [
          { data: null, error: { code: "PGRST116", message: "no rows" } },
          { data: null, error: null, count: 3 },
        ],
      }),
    });

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));

    expect(res.status).toBe(403);
    await expect(res.json()).resolves.toEqual({ error: "limit_reached" });
    expect(streamLLM).not.toHaveBeenCalled();
  });

  it("allows a free user below the cap and saves the lesson", async () => {
    const mock = mockSupabase({ user: USER, tables: baseTables() });

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.lesson.supabaseId).toBe("new-id");
    expect(mock.callCountFor("vocabulary_generation_events")).toBe(0);
  });

  it("allows Pro users without a separate usage table", async () => {
    const mock = mockSupabase({
      user: USER,
      tables: baseTables({
        profiles: { data: { ...PROFILE_ROW, pro_status: "active" }, error: null },
        generated_lessons: [
          { data: null, error: { code: "PGRST116", message: "no rows" } },
          { data: { id: "new-id" }, error: null },
        ],
      }),
    });

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));

    expect(res.status).toBe(200);
    expect(mock.callCountFor("vocabulary_generation_events")).toBe(0);
  });
});

describe("happy path generation", () => {
  it("resolves language/level, generates, saves, and returns the lesson", async () => {
    mockSupabase({ user: USER, tables: baseTables() });

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.reused).toBe(false);
    expect(body.lesson.supabaseId).toBe("new-id");
    expect(body.lesson.isUserGenerated).toBe(true);
    expect(body.lesson.vocabularyWords).toHaveLength(1);
    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain("Spanish");
    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain("greetings");
  });

  it("defaults to English/beginner when the profile has no language/level", async () => {
    mockSupabase({
      user: USER,
      tables: baseTables({
        profiles: { data: { id: "user-1", target_language: null, user_level: null }, error: null },
      }),
    });

    await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));

    expect(streamLLM.mock.calls[0][0].systemPrompt).toContain("English");
  });
});

describe("failure handling", () => {
  it("returns 502 when the model throws", async () => {
    mockSupabase({ user: USER, tables: baseTables() });
    modelThrows(new Error("Gemini timed out"));

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));

    expect(res.status).toBe(502);
    await expect(res.json()).resolves.toEqual({ error: "Could not generate words. Please try again." });
  });

  it("returns 502 when saving the generated lesson fails", async () => {
    mockSupabase({
      user: USER,
      tables: {
        profiles: { data: PROFILE_ROW, error: null },
        generated_lessons: [
          { data: null, error: { code: "PGRST116", message: "no rows" } },
          { data: null, error: null, count: 0 },
          { data: null, error: { message: "insert failed" } },
        ],
      },
    });

    const res = await POST(vocabRequest({ topic: "greetings", difficulty: "easy" }));

    expect(res.status).toBe(502);
  });
});
