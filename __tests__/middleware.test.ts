import { NextRequest } from "next/server";
import { config, middleware } from "../middleware";

jest.mock("@/lib/supabase/middleware", () => ({ updateSession: jest.fn() }));

const { updateSession } = jest.requireMock("@/lib/supabase/middleware");

const SESSION_RESPONSE = Symbol("session response");

function request(pathname: string) {
  return new NextRequest(`https://fina.app${pathname}`);
}

beforeEach(() => {
  updateSession.mockResolvedValue(SESSION_RESPONSE);
});

describe("middleware", () => {
  it.each(["/", "/app", "/app/vocabulary", "/login", "/signup"])(
    "delegates %s to the Supabase session refresh",
    async (pathname) => {
      const req = request(pathname);
      const res = await middleware(req);

      expect(updateSession).toHaveBeenCalledTimes(1);
      expect(updateSession).toHaveBeenCalledWith(req);
      expect(res).toBe(SESSION_RESPONSE);
    }
  );
});

describe("matcher config", () => {
  it("skips next internals and static assets", () => {
    const catchAll = config.matcher.find((m) => m.includes("?!"));

    expect(catchAll).toContain("_next/static");
    expect(catchAll).toContain("favicon.ico");
    expect(catchAll).toContain("icon.png");
    expect(catchAll).toContain("mp4");
  });

  it("skips the Sentry tunnel route", () => {
    const catchAll = config.matcher.find((m) => m.includes("?!"));

    expect(catchAll).toContain("?!monitoring|");
  });
});
