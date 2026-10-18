import type { NextRequest } from "next/server";
import { createSupabaseMock, writePayload, type SupabaseMock, type SupabaseMockConfig } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn() }));

import { DELETE, GET, PATCH } from "../route";
const { createClient } = jest.requireMock("@/lib/supabase/server");
const { createAdminClient } = jest.requireMock("@/lib/supabase/admin");

const ADMIN = { id: "admin-1", email: "owner@example.com" };
const VOUCHER = { id: "v1", code: "FINA-2026", active: true, redemption_count: 2 };
const ctx = { params: Promise.resolve({ id: "v1" }) };

let admin: SupabaseMock;

function setup(tables: SupabaseMockConfig["tables"], user: typeof ADMIN | null = ADMIN) {
  createClient.mockResolvedValue(createSupabaseMock({ user }));
  admin = createSupabaseMock({ tables });
  createAdminClient.mockReturnValue(admin);
}

function request(method: string, body?: unknown) {
  return new Request("http://localhost/api/admin/vouchers/v1", {
    method,
    headers: { "Content-Type": "application/json" },
    body: body === undefined ? undefined : JSON.stringify(body),
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

it("404s non-admins on every method", async () => {
  setup({}, { id: "user-1", email: "jane@example.com" });

  expect((await GET(request("GET"), ctx)).status).toBe(404);
  expect((await PATCH(request("PATCH", { active: false }), ctx)).status).toBe(404);
  expect((await DELETE(request("DELETE"), ctx)).status).toBe(404);
  expect(createAdminClient).not.toHaveBeenCalled();
});

describe("GET", () => {
  it("returns the voucher with redemptions joined to profile emails", async () => {
    setup({
      voucher_codes: { data: VOUCHER, error: null },
      voucher_redemptions: {
        data: [
          { user_id: "u1", redeemed_at: "2026-10-18T10:00:00Z", pro_until: "2027-10-18T10:00:00Z" },
          { user_id: "u2", redeemed_at: "2026-10-17T10:00:00Z", pro_until: "2027-10-17T10:00:00Z" },
        ],
        error: null,
      },
      profiles: { data: [{ id: "u1", email: "a@example.com" }], error: null },
    });

    const res = await GET(request("GET"), ctx);

    expect(res.status).toBe(200);
    await expect(res.json()).resolves.toEqual({
      voucher: VOUCHER,
      redemptions: [
        { userId: "u1", email: "a@example.com", redeemedAt: "2026-10-18T10:00:00Z", proUntil: "2027-10-18T10:00:00Z" },
        { userId: "u2", email: null, redeemedAt: "2026-10-17T10:00:00Z", proUntil: "2027-10-17T10:00:00Z" },
      ],
    });
    expect(admin.builderFor("profiles").in).toHaveBeenCalledWith("id", ["u1", "u2"]);
  });

  it("skips the profiles lookup when nobody has redeemed", async () => {
    setup({ voucher_codes: { data: VOUCHER, error: null }, voucher_redemptions: { data: [], error: null } });

    const res = await GET(request("GET"), ctx);

    await expect(res.json()).resolves.toEqual({ voucher: VOUCHER, redemptions: [] });
    expect(admin.callCountFor("profiles")).toBe(0);
  });

  it("404s an unknown id", async () => {
    setup({ voucher_codes: { data: null, error: null } });

    expect((await GET(request("GET"), ctx)).status).toBe(404);
  });
});

describe("PATCH", () => {
  it("writes only the fields sent, plus updated_at", async () => {
    setup({ voucher_codes: { data: { ...VOUCHER, active: false }, error: null } });

    const res = await PATCH(request("PATCH", { active: false }), ctx);

    expect(res.status).toBe(200);
    const payload = writePayload(admin, "voucher_codes", "update");
    expect(Object.keys(payload).sort()).toEqual(["active", "updated_at"]);
    expect(payload.active).toBe(false);
    expect(admin.builderFor("voucher_codes").eq).toHaveBeenCalledWith("id", "v1");
  });

  it("400s an invalid body", async () => {
    setup({});

    expect((await PATCH(request("PATCH", { maxRedemptions: 0 }), ctx)).status).toBe(400);
    expect(admin.callCountFor("voucher_codes")).toBe(0);
  });

  it("400s when the date check constraint fails", async () => {
    setup({ voucher_codes: { data: null, error: { message: "check", code: "23514" } } });

    expect((await PATCH(request("PATCH", { expiresAt: "2020-01-01T00:00:00Z" }), ctx)).status).toBe(400);
  });

  it("404s an unknown id", async () => {
    setup({ voucher_codes: { data: null, error: null } });

    expect((await PATCH(request("PATCH", { active: true }), ctx)).status).toBe(404);
  });
});

describe("DELETE", () => {
  it("deletes an unused voucher", async () => {
    setup({ voucher_codes: { data: [{ id: "v1" }], error: null } });

    const res = await DELETE(request("DELETE"), ctx);

    expect(res.status).toBe(200);
    expect(admin.builderFor("voucher_codes").delete).toHaveBeenCalled();
  });

  it("409s a redeemed voucher (foreign key restrict)", async () => {
    setup({ voucher_codes: { data: null, error: { message: "fk", code: "23503" } } });

    const res = await DELETE(request("DELETE"), ctx);

    expect(res.status).toBe(409);
    await expect(res.json()).resolves.toEqual({
      error: "This code has been redeemed, so it can't be deleted. Deactivate it instead.",
    });
  });

  it("404s an unknown id", async () => {
    setup({ voucher_codes: { data: [], error: null } });

    expect((await DELETE(request("DELETE"), ctx)).status).toBe(404);
  });
});
