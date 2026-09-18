import { GET } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

const USER = { id: "user-1" };

const SESSION_ID = "session-1";

function mockSupabase(config: SupabaseMockConfig) {
  const mock = createSupabaseMock(config);
  createClient.mockResolvedValue(mock);
  return mock;
}

function configRequest(query = `?sessionId=${SESSION_ID}`) {
  return new Request(`http://localhost/api/realtime/config${query}`);
}

global.fetch = jest.fn();

describe("GET /api/realtime/config", () => {
  beforeEach(() => {
    process.env.INWORLD_API_KEY = "test-key-123";
    (global.fetch as jest.Mock).mockResolvedValue({
      ok: true,
      json: async () => ({
        iceServers: [{ urls: "stun:stun.example.com" }],
      }),
    });
  });

  afterEach(() => {
    jest.clearAllMocks();
    delete process.env.INWORLD_API_KEY;
  });

  it("returns 401 with no authenticated user", async () => {
    mockSupabase({ user: null });

    const response = await GET(configRequest());

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("returns iceServers but NOT the apiKey", async () => {
    mockSupabase({ user: USER });

    const response = await GET(configRequest());
    const data = await response.json();

    expect(data.iceServers).toEqual([{ urls: "stun:stun.example.com" }]);
    expect(data.apiKey).toBeUndefined();
    expect(data.realtimeUrl).toBeUndefined();
  });

  it("calls Inworld ICE servers endpoint with auth header", async () => {
    mockSupabase({ user: USER });

    await GET(configRequest());

    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.inworld.ai/v1/realtime/ice-servers",
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: "Basic test-key-123",
        }),
      })
    );
  });

  it("returns 500 when Inworld ICE endpoint fails", async () => {
    mockSupabase({ user: USER });
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 503 });

    const response = await GET(configRequest());
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });

  it("returns 403 invalid_session without a ?sessionId=, without calling Inworld", async () => {
    mockSupabase({ user: USER });

    const response = await GET(configRequest(""));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "invalid_session" });
    expect(global.fetch).not.toHaveBeenCalled();
  });

  it("does not query a conversation table for a transient session id", async () => {
    const mock = mockSupabase({ user: USER });

    const response = await GET(configRequest());

    expect(response.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not require a persisted session age check", async () => {
    const mock = mockSupabase({ user: USER });

    const response = await GET(configRequest());

    expect(response.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not query a missing conversation table", async () => {
    const mock = mockSupabase({ user: USER });

    await GET(configRequest());

    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("returns 500 when INWORLD_API_KEY is not set", async () => {
    mockSupabase({ user: USER });
    delete process.env.INWORLD_API_KEY;

    const response = await GET(configRequest());
    expect(response.status).toBe(500);

    const data = await response.json();
    expect(data.error).toBeDefined();
  });
});
