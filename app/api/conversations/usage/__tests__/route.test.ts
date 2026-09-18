import { GET } from "../route";
import { createSupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

const USER = { id: "user-1", email: "jane@example.com" };

function mockSupabase(opts: { user?: SupabaseMockConfig["user"]; profile?: Record<string, unknown> | null } = {}) {
  const { user = USER, profile = { pro_status: null, pro_current_period_end: null } } = opts;
  const mock = createSupabaseMock({ user, tables: { profiles: { data: profile, error: null } } });
  createClient.mockResolvedValue(mock);
  return mock;
}

describe("GET /api/conversations/usage", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    const res = await GET();
    expect(res.status).toBe(401);
  });

  it("reports the full temporary allowance without querying a conversation table", async () => {
    const mock = mockSupabase();

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ isPro: false, freeLimit: 3, freeUsed: 0, freeRemaining: 3 });
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("keeps the unlimited Pro response without querying a conversation table", async () => {
    const mock = mockSupabase({ profile: { pro_status: "active", pro_current_period_end: null } });

    const res = await GET();

    await expect(res.json()).resolves.toEqual({ isPro: true, freeLimit: 3, freeUsed: 0, freeRemaining: 999 });
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });
});
