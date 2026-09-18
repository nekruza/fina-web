import { POST } from "../route";
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

const INWORLD_CALLS_URL = "https://api.inworld.ai/v1/realtime/calls";

global.fetch = jest.fn();

const mockFetch = global.fetch as jest.Mock;

function connectRequest(body: unknown) {
  const withSession =
    body && typeof body === "object" && !("sessionId" in body) ? { sessionId: SESSION_ID, ...body } : body;
  return new Request("http://localhost/api/realtime/connect", {
    method: "POST",
    body: JSON.stringify(withSession),
  });
}

describe("POST /api/realtime/connect", () => {
  beforeEach(() => {
    process.env.INWORLD_API_KEY = "test-key-123";
    mockSupabase({ user: USER });
  });

  afterEach(() => {
    delete process.env.INWORLD_API_KEY;
  });

  it("returns 401 with no authenticated user", async () => {
    mockSupabase({ user: null });

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "Unauthorized" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("proxies the SDP offer to Inworld and returns the SDP answer", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "v=0\r\na=sendrecv\r\n" });

    const response = await POST(connectRequest({ sdp: "v=0\r\noffer sdp\r\n" }));

    expect(response.status).toBe(200);
    expect(await response.text()).toBe("v=0\r\na=sendrecv\r\n");
  });

  it("returns the answer as application/sdp so the browser can consume it", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "answer" });

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.headers.get("Content-Type")).toBe("application/sdp");
  });

  it("forwards the offer to the calls endpoint with Basic auth", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "answer" });

    await POST(connectRequest({ sdp: "my-sdp-offer" }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(mockFetch).toHaveBeenCalledWith(
      INWORLD_CALLS_URL,
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          Authorization: "Basic test-key-123",
          "Content-Type": "application/sdp",
        }),
        body: "my-sdp-offer",
      })
    );
  });

  it("sends the raw SDP as the body, not a JSON envelope", async () => {
    mockFetch.mockResolvedValue({ ok: true, text: async () => "answer" });

    await POST(connectRequest({ sdp: "v=0\r\nraw\r\n" }));

    expect(mockFetch.mock.calls[0][1].body).toBe("v=0\r\nraw\r\n");
  });

  it("returns 500 with the upstream status when the SDP exchange fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 503,
      text: async () => "upstream unavailable",
    });

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "SDP exchange failed: 503",
      detail: "upstream unavailable",
    });
  });

  it("still returns 500 when the upstream error body cannot be read", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      status: 500,
      text: async () => {
        throw new Error("stream closed");
      },
    });

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "SDP exchange failed: 500",
      detail: "",
    });
  });

  it("returns 400 when the SDP offer is missing", async () => {
    const response = await POST(connectRequest({}));

    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toEqual({ error: "Missing SDP offer" });
  });

  it("returns 400 without calling Inworld when the SDP is an empty string", async () => {
    const response = await POST(connectRequest({ sdp: "" }));

    expect(response.status).toBe(400);
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 500 when the API key is not configured", async () => {
    delete process.env.INWORLD_API_KEY;

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.status).toBe(500);
    await expect(response.json()).resolves.toEqual({
      error: "INWORLD_API_KEY not configured",
    });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns 403 invalid_session without a sessionId, without calling Inworld", async () => {
    const response = await POST(connectRequest({ sdp: "offer", sessionId: undefined }));

    expect(response.status).toBe(403);
    await expect(response.json()).resolves.toEqual({ error: "invalid_session" });
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("does not query a conversation table for a transient session id", async () => {
    const mock = mockSupabase({ user: USER });
    mockFetch.mockResolvedValue({ ok: true, text: async () => "answer" });

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not require a persisted session age check", async () => {
    const mock = mockSupabase({ user: USER });
    mockFetch.mockResolvedValue({ ok: true, text: async () => "answer" });

    const response = await POST(connectRequest({ sdp: "offer" }));

    expect(response.status).toBe(200);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("does not query a missing conversation table", async () => {
    const mock = mockSupabase({ user: USER });
    mockFetch.mockResolvedValue({ ok: true, text: async () => "answer" });

    await POST(connectRequest({ sdp: "offer" }));

    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("checks the API key before parsing the body", async () => {
    delete process.env.INWORLD_API_KEY;

    const req = new Request("http://localhost/api/realtime/connect", {
      method: "POST",
      body: "not json",
    });

    // Must not throw a JSON parse error — the config guard runs first.
    const response = await POST(req);
    expect(response.status).toBe(500);
  });
});
