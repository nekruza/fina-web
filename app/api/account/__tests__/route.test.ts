import type { SupabaseMockConfig } from "@/test-utils/supabase-mock";
import { createSupabaseMock } from "@/test-utils/supabase-mock";

jest.mock("@/lib/supabase/server", () => ({ createClient: jest.fn() }));

const deleteUser = jest.fn(async (): Promise<{ error: { message: string } | null }> => ({ error: null }));
jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(() => ({ auth: { admin: { deleteUser } } })),
}));

const cancelSubscription = jest.fn(async () => ({ id: "sub_123", status: "canceled" }));
jest.mock("@/lib/stripe", () => ({
  getStripe: jest.fn(() => ({ subscriptions: { cancel: cancelSubscription } })),
}));

// The route imports `getStripe` from `@/lib/stripe` at module scope (only the
// client construction inside it is lazy), so this module must be required
// after the mocks and consts above are in place — a static import would be
// hoisted above them and crash on the mocked factory's own references.
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { DELETE } = require("../route") as typeof import("../route");
const { createClient } = jest.requireMock("@/lib/supabase/server");
const { createAdminClient } = jest.requireMock("@/lib/supabase/admin");
const { getStripe } = jest.requireMock("@/lib/stripe");

const USER = { id: "user-1", email: "jane@example.com" };

const DELETE_ORDER = [
  "generated_lessons",
  "custom_roleplays",
  "favorite_words",
  "lesson_progress",
  "profiles",
];

function mockSupabase(opts: { user?: SupabaseMockConfig["user"]; tables?: SupabaseMockConfig["tables"] }) {
  const { user = USER, tables = {} } = opts;
  const mock = createSupabaseMock({ user, tables });
  createClient.mockResolvedValue(mock);
  return mock;
}

const ORIGINAL_ENV = process.env.SUPABASE_SERVICE_ROLE_KEY;

afterEach(() => {
  process.env.SUPABASE_SERVICE_ROLE_KEY = ORIGINAL_ENV;
});

describe("DELETE /api/account", () => {
  it("returns 401 for an anonymous caller", async () => {
    mockSupabase({ user: null });
    const res = await DELETE();
    expect(res.status).toBe(401);
  });

  it("deletes each table in order, scoped to the caller", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    const mock = mockSupabase({});

    const res = await DELETE();

    expect(res.status).toBe(200);
    // The first "profiles" call is the pre-deletion billing-status lookup;
    // the rest are the actual per-table deletes, in dependency order.
    expect(mock.calls.map((c) => c.table)).toEqual(["profiles", ...DELETE_ORDER]);
    for (const table of DELETE_ORDER) {
      const builder = mock.builderFor(table, table === "profiles" ? 1 : 0);
      expect(builder.delete).toHaveBeenCalled();
      const idColumn = table === "profiles" ? "id" : "user_id";
      expect(builder.eq).toHaveBeenCalledWith(idColumn, "user-1");
    }
    expect(cancelSubscription).not.toHaveBeenCalled();
  });

  it("returns authDeleted: false when the service role key is not configured", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mockSupabase({});

    const res = await DELETE();

    await expect(res.json()).resolves.toEqual({ ok: true, authDeleted: false });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  it("returns authDeleted: true and calls the admin client when the service role key is configured", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    mockSupabase({});

    const res = await DELETE();

    await expect(res.json()).resolves.toEqual({ ok: true, authDeleted: true });
    expect(createAdminClient).toHaveBeenCalled();
    expect(deleteUser).toHaveBeenCalledWith("user-1");
  });

  it("returns authDeleted: false when the admin deleteUser call errors", async () => {
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    deleteUser.mockResolvedValueOnce({ error: { message: "boom" } });
    mockSupabase({});

    const res = await DELETE();

    await expect(res.json()).resolves.toEqual({ ok: true, authDeleted: false });
  });

  it("returns 500 when a row delete fails, and does not proceed to auth deletion", async () => {
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    mockSupabase({ tables: { favorite_words: { data: null, error: { message: "boom" } } } });

    const res = await DELETE();

    expect(res.status).toBe(500);
    await expect(res.json()).resolves.toEqual({ error: "Failed to delete account data" });
    expect(createAdminClient).not.toHaveBeenCalled();
  });

  describe("canceling a billed subscription before deleting", () => {
    it.each(["active", "trialing", "past_due"])(
      "cancels a %s subscription, then proceeds to delete everything",
      async (proStatus) => {
        delete process.env.SUPABASE_SERVICE_ROLE_KEY;
        mockSupabase({
          tables: { profiles: { data: { stripe_subscription_id: "sub_123", pro_status: proStatus }, error: null } },
        });

        const res = await DELETE();

        expect(cancelSubscription).toHaveBeenCalledWith("sub_123");
        expect(res.status).toBe(200);
        await expect(res.json()).resolves.toEqual({ ok: true, authDeleted: false });
      }
    );

    it("returns 502 and deletes nothing when cancellation fails", async () => {
      cancelSubscription.mockRejectedValueOnce(new Error("stripe down"));
      const mock = mockSupabase({
        tables: { profiles: { data: { stripe_subscription_id: "sub_123", pro_status: "active" }, error: null } },
      });

      const res = await DELETE();

      expect(res.status).toBe(502);
      await expect(res.json()).resolves.toEqual({
        error: "Couldn't cancel your subscription. Please try again or manage it in billing.",
      });
      // Only the pre-check select happened — no deletes, no auth deletion.
      expect(mock.calls.map((c) => c.table)).toEqual(["profiles"]);
      expect(mock.builderFor("profiles").delete).not.toHaveBeenCalled();
      expect(createAdminClient).not.toHaveBeenCalled();
    });

    it("does not attempt to cancel, and proceeds as before, when there is no subscription", async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      mockSupabase({
        tables: { profiles: { data: { stripe_subscription_id: null, pro_status: null }, error: null } },
      });

      const res = await DELETE();

      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(getStripe).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("does not attempt to cancel a subscription that is already canceled", async () => {
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      mockSupabase({
        tables: { profiles: { data: { stripe_subscription_id: "sub_123", pro_status: "canceled" }, error: null } },
      });

      const res = await DELETE();

      expect(cancelSubscription).not.toHaveBeenCalled();
      expect(res.status).toBe(200);
    });
  });
});
