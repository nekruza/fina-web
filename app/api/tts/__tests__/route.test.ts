import { POST } from "../route";
import { createSupabaseMock } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

function signedIn(user: { id: string } | null = { id: "user-1" }) {
  createClient.mockResolvedValue(createSupabaseMock({ user }));
}

const INWORLD_URL = "https://api.inworld.ai/tts/v1/voice";
const KOKORO_URL = "https://chutes-kokoro.chutes.ai/speak";

global.fetch = jest.fn();
const mockFetch = () => global.fetch as jest.Mock;

function ttsRequest(body: unknown) {
  return new Request("http://localhost/api/tts", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

/** base64 for the bytes 0xDE 0xAD 0xBE 0xEF */
const AUDIO_B64 = Buffer.from([0xde, 0xad, 0xbe, 0xef]).toString("base64");

function inworldOk(audioContent: string | null = AUDIO_B64) {
  return { ok: true, json: async () => ({ audioContent }) };
}

function kokoroOk(contentType = "audio/mpeg") {
  return {
    ok: true,
    body: new ReadableStream(),
    headers: new Headers({ "Content-Type": contentType }),
  };
}

const ORIGINAL_ENV = { ...process.env };

beforeEach(() => {
  signedIn();
  process.env.INWORLD_API_KEY = "inworld-key";
  process.env.CHUTES_API_KEY = "chutes-key";
  delete process.env.INWORLD_VOICE_ID;
});

afterEach(() => {
  process.env = { ...ORIGINAL_ENV };
});

describe("authorisation", () => {
  it("returns 401 for a signed-out caller without calling any provider", async () => {
    signedIn(null);

    const res = await POST(ttsRequest({ text: "Hello there." }));

    expect(res.status).toBe(401);
    await expect(res.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockFetch()).not.toHaveBeenCalled();
  });
});

describe("validation", () => {
  it("returns 400 for a malformed body", async () => {
    const res = await POST(ttsRequest("not json"));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Invalid request body" });
  });

  it("returns 400 when text is missing", async () => {
    const res = await POST(ttsRequest({}));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: "Missing text" });
  });

  it("returns 400 when text is blank", async () => {
    const res = await POST(ttsRequest({ text: "   " }));

    expect(res.status).toBe(400);
  });

  it("does not call any provider when validation fails", async () => {
    await POST(ttsRequest({ text: "" }));

    expect(mockFetch()).not.toHaveBeenCalled();
  });
});

describe("Inworld primary provider", () => {
  it("returns the synthesised audio as mpeg", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    const res = await POST(ttsRequest({ text: "Hello there." }));

    expect(res.status).toBe(200);
    expect(res.headers.get("Content-Type")).toBe("audio/mpeg");
    expect(Buffer.from(await res.arrayBuffer())).toEqual(
      Buffer.from([0xde, 0xad, 0xbe, 0xef])
    );
  });

  it("does not let the browser cache generated speech", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.headers.get("Cache-Control")).toBe("no-store");
  });

  it("sends the text and model with Basic auth", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hello." }));

    expect(mockFetch()).toHaveBeenCalledWith(
      INWORLD_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Basic inworld-key" }),
      })
    );
    expect(JSON.parse(mockFetch().mock.calls[0][1].body)).toMatchObject({
      text: "Hello.",
      modelId: "inworld-tts-1.5-mini",
    });
  });

  it("uses the requested voice", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hello.", voiceId: "Clive" }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Clive");
  });

  it("falls back to the configured default voice", async () => {
    process.env.INWORLD_VOICE_ID = "Ashley";
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hello." }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Ashley");
  });

  it("falls back to Jason when nothing is configured", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hello." }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Jason");
  });

  it("ignores a non-string voiceId", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hello.", voiceId: 42 }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Jason");
  });

  it("uses the language's pronunciation voice when no voiceId is given", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hola.", language: "spanish" }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Diego");
  });

  it("prefers an explicit voiceId over the language fallback", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hola.", voiceId: "Clive", language: "spanish" }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Clive");
  });

  it("keeps TTS 1.5 Mini and sends no language for languages it supports", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hola.", language: "spanish" }));

    const body = JSON.parse(mockFetch().mock.calls[0][1].body);
    expect(body.modelId).toBe("inworld-tts-1.5-mini");
    expect(body).not.toHaveProperty("language");
  });

  it("synthesises Czech with TTS-2 and the cs-CZ locale", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Ahoj.", language: "czech" }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body)).toMatchObject({
      text: "Ahoj.",
      voiceId: "Ashley",
      modelId: "inworld-tts-2",
      language: "cs-CZ",
    });
  });

  it("recognises Czech from a speech locale and keeps an explicit voice", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Ahoj.", voiceId: "Szymon", language: "cs-CZ" }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body)).toMatchObject({
      voiceId: "Szymon",
      modelId: "inworld-tts-2",
      language: "cs-CZ",
    });
  });

  it("ignores an invalid language and falls back to the default voice", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    await POST(ttsRequest({ text: "Hello.", language: "klingon" }));

    expect(JSON.parse(mockFetch().mock.calls[0][1].body).voiceId).toBe("Jason");
  });
});

describe("text length cap", () => {
  it("accepts text right at the 600 character limit", async () => {
    mockFetch().mockResolvedValue(inworldOk());

    const res = await POST(ttsRequest({ text: "a".repeat(600) }));

    expect(res.status).toBe(200);
  });

  it("returns 400 for text over 600 characters", async () => {
    const res = await POST(ttsRequest({ text: "a".repeat(601) }));

    expect(res.status).toBe(400);
    expect(mockFetch()).not.toHaveBeenCalled();
  });
});

describe("Kokoro fallback", () => {
  it("streams Kokoro audio when Inworld returns an error", async () => {
    mockFetch()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce(kokoroOk());

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(200);
    expect(mockFetch().mock.calls[1][0]).toBe(KOKORO_URL);
  });

  it("falls back when Inworld returns no audio content", async () => {
    mockFetch()
      .mockResolvedValueOnce(inworldOk(null))
      .mockResolvedValueOnce(kokoroOk());

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(200);
    expect(mockFetch()).toHaveBeenCalledTimes(2);
  });

  it("falls back when the Inworld request throws", async () => {
    mockFetch()
      .mockRejectedValueOnce(new Error("network down"))
      .mockResolvedValueOnce(kokoroOk());

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(200);
  });

  it("goes straight to Kokoro when Inworld is not configured", async () => {
    delete process.env.INWORLD_API_KEY;
    mockFetch().mockResolvedValue(kokoroOk());

    await POST(ttsRequest({ text: "Hello." }));

    expect(mockFetch()).toHaveBeenCalledTimes(1);
    expect(mockFetch().mock.calls[0][0]).toBe(KOKORO_URL);
  });

  it("authenticates to Kokoro with a bearer token", async () => {
    delete process.env.INWORLD_API_KEY;
    mockFetch().mockResolvedValue(kokoroOk());

    await POST(ttsRequest({ text: "Hello." }));

    expect(mockFetch()).toHaveBeenCalledWith(
      KOKORO_URL,
      expect.objectContaining({
        headers: expect.objectContaining({ Authorization: "Bearer chutes-key" }),
      })
    );
  });

  it("passes through the Kokoro content type", async () => {
    delete process.env.INWORLD_API_KEY;
    mockFetch().mockResolvedValue(kokoroOk("audio/wav"));

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.headers.get("Content-Type")).toBe("audio/wav");
  });
});

describe("total failure", () => {
  it("returns 503 so the client can use browser speech when no provider is configured", async () => {
    delete process.env.INWORLD_API_KEY;
    delete process.env.CHUTES_API_KEY;

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(503);
    expect(mockFetch()).not.toHaveBeenCalled();
  });

  it("returns 503 when Kokoro returns an error", async () => {
    delete process.env.INWORLD_API_KEY;
    mockFetch().mockResolvedValue({ ok: false, status: 502, body: null });

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(503);
  });

  it("returns 503 when Kokoro returns no body", async () => {
    delete process.env.INWORLD_API_KEY;
    mockFetch().mockResolvedValue({ ok: true, body: null, headers: new Headers() });

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(503);
  });

  it("returns 503 when the Kokoro request throws", async () => {
    delete process.env.INWORLD_API_KEY;
    mockFetch().mockRejectedValue(new Error("network down"));

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(503);
  });

  it("returns 503 when both providers fail", async () => {
    mockFetch()
      .mockResolvedValueOnce({ ok: false, status: 500 })
      .mockResolvedValueOnce({ ok: false, status: 500, body: null });

    const res = await POST(ttsRequest({ text: "Hello." }));

    expect(res.status).toBe(503);
  });
});
