import { isAdminEmail, requireAdmin } from "../require-admin";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const { createClient } = jest.requireMock("@/lib/supabase/server");

function mockUser(user: { id: string; email?: string } | null) {
  createClient.mockResolvedValue({ auth: { getUser: jest.fn().mockResolvedValue({ data: { user } }) } });
}

const ORIGINAL = process.env.ADMIN_EMAILS;
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
});

describe("isAdminEmail", () => {
  const env = { ADMIN_EMAILS: " Owner@Example.com, ops@example.com ,," } as unknown as NodeJS.ProcessEnv;

  it("matches case-insensitively and ignores whitespace", () => {
    expect(isAdminEmail("owner@example.com", env)).toBe(true);
    expect(isAdminEmail(" OPS@example.com", env)).toBe(true);
  });

  it("rejects other emails, empty emails, and partial matches", () => {
    expect(isAdminEmail("someone@example.com", env)).toBe(false);
    expect(isAdminEmail("", env)).toBe(false);
    expect(isAdminEmail(null, env)).toBe(false);
    expect(isAdminEmail("example.com", env)).toBe(false);
  });

  it("treats an unset list as no admins", () => {
    expect(isAdminEmail("owner@example.com", {} as NodeJS.ProcessEnv)).toBe(false);
  });
});

describe("requireAdmin", () => {
  it("returns the user for an admin", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    mockUser({ id: "u1", email: "owner@example.com" });

    const { user, response } = await requireAdmin();

    expect(user).toEqual({ id: "u1", email: "owner@example.com" });
    expect(response).toBeUndefined();
  });

  it("404s a signed-in non-admin", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    mockUser({ id: "u2", email: "user@example.com" });

    const { user, response } = await requireAdmin();

    expect(user).toBeNull();
    expect(response?.status).toBe(404);
  });

  it("401s an anonymous caller", async () => {
    process.env.ADMIN_EMAILS = "owner@example.com";
    mockUser(null);

    const { response } = await requireAdmin();

    expect(response?.status).toBe(401);
  });
});
