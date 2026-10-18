import type { NextRequest } from "next/server";
import { createSupabaseMock } from "@/test-utils/supabase-mock";
import { REDEEM_ERRORS } from "@/lib/vouchers";

const rpc = jest.fn();
jest.mock("@/lib/supabase/admin", () => ({ createAdminClient: jest.fn(() => ({ rpc })) }));
jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

import { POST } from "../route";
const { createClient } = jest.requireMock("@/lib/supabase/server");

const USER = { id: "user-1", email: "jane@example.com" };

function redeemRequest(body: unknown) {
  return new Request("http://localhost/api/vouchers/redeem", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: typeof body === "string" ? body : JSON.stringify(body),
  }) as unknown as NextRequest;
}

const ORIGINAL_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

beforeEach(() => {
  rpc.mockReset();
  createClient.mockResolvedValue(createSupabaseMock({ user: USER }));
  process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role";
  jest.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  if (ORIGINAL_KEY === undefined) delete process.env.SUPABASE_SERVICE_ROLE_KEY;
  else process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_KEY;
  jest.restoreAllMocks();
});

it("returns 401 for an anonymous caller", async () => {
  createClient.mockResolvedValue(createSupabaseMock({ user: null }));

  const res = await POST(redeemRequest({ code: "FINA-2026" }));

  expect(res.status).toBe(401);
  expect(rpc).not.toHaveBeenCalled();
});

it.each([{}, { code: 123 }, { code: "ab" }, { code: "has spaces" }, "not json"])(
  "rejects a malformed code %p without calling the database",
  async (body) => {
    const res = await POST(redeemRequest(body));

    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: REDEEM_ERRORS.invalid.message, status: "invalid" });
    expect(rpc).not.toHaveBeenCalled();
  }
);

it("normalizes the code and redeems it for the signed-in user", async () => {
  rpc.mockResolvedValue({ data: { status: "ok", pro_until: "2027-10-18T09:00:00+00:00" }, error: null });

  const res = await POST(redeemRequest({ code: "  fina-2026 " }));

  expect(rpc).toHaveBeenCalledWith("redeem_voucher", { p_code: "FINA-2026", p_user_id: USER.id });
  expect(res.status).toBe(200);
  await expect(res.json()).resolves.toEqual({ status: "ok", proUntil: "2027-10-18T09:00:00+00:00" });
});

it.each(Object.entries(REDEEM_ERRORS))("maps %s to its HTTP status and message", async (status, expected) => {
  rpc.mockResolvedValue({ data: { status }, error: null });

  const res = await POST(redeemRequest({ code: "FINA-2026" }));

  expect(res.status).toBe(expected.status);
  await expect(res.json()).resolves.toEqual({ error: expected.message, status });
});

it("returns 500 when the RPC errors", async () => {
  rpc.mockResolvedValue({ data: null, error: { message: "function does not exist" } });

  const res = await POST(redeemRequest({ code: "FINA-2026" }));

  expect(res.status).toBe(500);
});

it("returns 500 for an unrecognised RPC status", async () => {
  rpc.mockResolvedValue({ data: { status: "weird" }, error: null });

  const res = await POST(redeemRequest({ code: "FINA-2026" }));

  expect(res.status).toBe(500);
});

it("returns 500 without the service-role key", async () => {
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;

  const res = await POST(redeemRequest({ code: "FINA-2026" }));

  expect(res.status).toBe(500);
  expect(rpc).not.toHaveBeenCalled();
});
