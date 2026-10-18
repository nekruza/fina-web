import { requireUser } from "../require-user";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

function mockUser(user: { id: string } | null) {
  const supabase = { auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) } };
  createClient.mockResolvedValue(supabase);
  return supabase;
}

describe("requireUser", () => {
  it("returns the client and user when signed in", async () => {
    const supabase = mockUser({ id: "user-1" });

    const result = await requireUser();

    expect(result.user).toEqual({ id: "user-1" });
    expect(result.supabase).toBe(supabase);
    expect(result.response).toBeUndefined();
  });

  it("returns a 401 JSON response when signed out", async () => {
    mockUser(null);

    const { user, response } = await requireUser();

    expect(user).toBeNull();
    expect(response?.status).toBe(401);
    expect(await response?.json()).toEqual({ error: "Unauthorized" });
  });
});
