import type { NextRequest } from "next/server";
import { createSupabaseMock, writePayload, type SupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { GET, POST } from "../route";
const { createClient } = jest.requireMock("@/lib/supabase/server");
const { createAdminClient } = jest.requireMock("@/lib/supabase/admin");

const ADMIN = { id: "admin-1", email: "owner@example.com" };
const USER = { id: "user-1", email: "jane@example.com" };

const VOUCHER = {
  id: "v1",
  code: "FINA-2026",
  description: null,
  duration_days: 365,
  max_redemptions: 100,
  redemption_count: 3,
  starts_at: null,
  expires_at: null,
  active: true,
  created_at: "2026-10-18T00:00:00Z",
  updated_at: "2026-10-18T00:00:00Z",
};

let admin: SupabaseMock;

function signIn(user: { id: string; email: string } | null) {
  createClient.mockResolvedValue(createSupabaseMock({ user }));
}

function useAdminDb(tables: SupabaseMockConfig["tables"]) {
  admin = createSupabaseMock({ tables });
  createAdminClient.mockReturnValue(admin);
}

function postRequest(body: unknown) {
  return new Request("http://localhost/api/admin/vouchers", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ORIGINAL = process.env.ADMIN_EMAILS;
beforeEach(() => {
  process.env.ADMIN_EMAILS = ADMIN.email;
  jest.spyOn(console, "error").mockImplementation(() => {});
});
afterEach(() => {
  if (ORIGINAL === undefined) delete process.env.ADMIN_EMAILS;
  else process.env.ADMIN_EMAILS = ORIGINAL;
  jest.restoreAllMocks();
});

describe("access", () => {
  it("401s an anonymous caller", async () => {
    signIn(null);
    useAdminDb({});

    expect((await GET()).status).toBe(401);
    expect((await POST(postRequest({}))).status).toBe(401);
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("404s a signed-in non-admin without touching the database", async () => {
    signIn(USER);
    useAdminDb({});

    expect((await GET()).status).toBe(404);
    expect((await POST(postRequest({}))).status).toBe(404);
    expect(createAdminClient).not.toHaveBeenCalled();
  });
});

describe("GET", () => {
  it("lists vouchers newest first", async () => {
    signIn(ADMIN);
    useAdminDb({ voucher_codes: { data: [VOUCHER], error: null } });

    const res = await GET();

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({ vouchers: [VOUCHER] });
    expect(admin.builderFor("voucher_codes").order).toHaveBeenCalledWith("created_at", { ascending: false });
  });

  it("500s on a database error", async () => {
    signIn(ADMIN);
    useAdminDb({ voucher_codes: { data: null, error: { message: "relation does not exist" } } });

    expect((await GET()).status).toBe(500);
  });
});

describe("POST", () => {
  it("creates a voucher from the parsed body", async () => {
    signIn(ADMIN);
    useAdminDb({ voucher_codes: { data: VOUCHER, error: null } });

    const res = await POST(postRequest({ code: "fina-2026", maxRedemptions: 100 }));

    expect(res.status).toBe(201);
    await expect(res.json()).resolves.toEqual({ voucher: VOUCHER });
    expect(writePayload(admin, "voucher_codes", "insert")).toEqual({
      code: "FINA-2026",
      description: null,
      duration_days: 365,
      max_redemptions: 100,
      starts_at: null,
      expires_at: null,
      active: true,
    });
  });

  it("400s an invalid body without inserting", async () => {
    signIn(ADMIN);
    useAdminDb({});

    const res = await POST(postRequest({ maxRedemptions: 0 }));

    expect(res.status).toBe(400);
    expect(admin.callCountFor("voucher_codes")).toBe(0);
  });

  it("409s a duplicate code", async () => {
    signIn(ADMIN);
    useAdminDb({ voucher_codes: { data: null, error: { message: "duplicate", code: "23505" } } });

    const res = await POST(postRequest({ code: "FINA-2026" }));

    expect(res.status).toBe(409);
  });
});
