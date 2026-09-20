import { Home } from "../page";

const getUser = jest.fn();
jest.mock("@/lib/supabase/server", () => ({
  createClient: jest.fn(async () => ({ auth: { getUser } })),
}));

jest.mock("next/navigation", () => ({
  redirect: jest.fn((destination: string): never => {
    throw new Error(`NEXT_REDIRECT:${destination}`);
  }),
}));

const redirect = jest.requireMock("next/navigation").redirect as jest.Mock;

describe("/ root route", () => {
  beforeEach(() => {
    getUser.mockReset();
    redirect.mockClear();
  });

  it("redirects signed-out visitors to login", async () => {
    getUser.mockResolvedValue({ data: { user: null } });

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/login");
    expect(redirect).toHaveBeenCalledWith("/login");
  });

  it("redirects signed-in visitors to the dashboard", async () => {
    getUser.mockResolvedValue({ data: { user: { id: "user-1" } } });

    await expect(Home()).rejects.toThrow("NEXT_REDIRECT:/app");
    expect(redirect).toHaveBeenCalledWith("/app");
  });
});
