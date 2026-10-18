import {
  generateVoucherCode,
  isRedeemStatus,
  isValidVoucherCode,
  normalizeVoucherCode,
  parseVoucherCreate,
  parseVoucherPatch,
  voucherState,
} from "../vouchers";

describe("normalizeVoucherCode / isValidVoucherCode", () => {
  it("trims and upper-cases", () => expect(normalizeVoucherCode("  fina-2026 ")).toBe("FINA-2026"));

  it.each(["FINA", "FINA-7KQ2-M9XD", "SUMMER_2026", "A".repeat(40)])("accepts %s", (code) =>
    expect(isValidVoucherCode(code)).toBe(true)
  );

  it.each(["", "ABC", "A".repeat(41), "fina-2026", "FINA 2026", "FINA!"])("rejects %p", (code) =>
    expect(isValidVoucherCode(code)).toBe(false)
  );
});

describe("generateVoucherCode", () => {
  it("produces a valid PREFIX-XXXX-XXXX code without ambiguous characters", () => {
    for (let i = 0; i < 50; i++) {
      const code = generateVoucherCode();
      expect(code).toMatch(/^FINA-[A-HJKMNP-Z2-9]{4}-[A-HJKMNP-Z2-9]{4}$/);
      expect(isValidVoucherCode(code)).toBe(true);
    }
  });

  it("uses the given prefix", () => expect(generateVoucherCode("VIP")).toMatch(/^VIP-/));

  it("does not repeat", () => {
    const codes = new Set(Array.from({ length: 200 }, () => generateVoucherCode()));
    expect(codes.size).toBe(200);
  });
});

describe("isRedeemStatus", () => {
  it.each(["ok", "invalid", "exhausted", "has_subscription"])("accepts %s", (s) => expect(isRedeemStatus(s)).toBe(true));
  it.each(["nope", null, undefined, 1, "toString"])("rejects %p", (s) => expect(isRedeemStatus(s)).toBe(false));
});

describe("voucherState", () => {
  const now = new Date("2026-10-18T12:00:00Z");
  const base = { active: true, starts_at: null, expires_at: null, max_redemptions: null, redemption_count: 0 };

  it("is active by default", () => expect(voucherState(base, now)).toBe("active"));
  it("is disabled when inactive, whatever else holds", () =>
    expect(voucherState({ ...base, active: false, expires_at: "2020-01-01T00:00:00Z" }, now)).toBe("disabled"));
  it("is expired at or after expires_at", () =>
    expect(voucherState({ ...base, expires_at: "2026-10-18T12:00:00Z" }, now)).toBe("expired"));
  it("is used up at the limit", () =>
    expect(voucherState({ ...base, max_redemptions: 5, redemption_count: 5 }, now)).toBe("used_up"));
  it("is active below the limit", () =>
    expect(voucherState({ ...base, max_redemptions: 5, redemption_count: 4 }, now)).toBe("active"));
  it("is scheduled before starts_at", () =>
    expect(voucherState({ ...base, starts_at: "2026-11-01T00:00:00Z" }, now)).toBe("scheduled"));
});

describe("parseVoucherCreate", () => {
  it("fills defaults and generates a code when none is given", () => {
    const r = parseVoucherCreate({});
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(isValidVoucherCode(r.value.code)).toBe(true);
    expect(r.value).toMatchObject({
      description: null,
      duration_days: 365,
      max_redemptions: null,
      starts_at: null,
      expires_at: null,
      active: true,
    });
  });

  it("normalizes a given code and maps camelCase to columns", () => {
    const r = parseVoucherCreate({
      code: " launch-week ",
      description: "  Launch  ",
      durationDays: 30,
      maxRedemptions: 100,
      startsAt: "2026-10-20T00:00:00Z",
      expiresAt: "2026-12-31T23:59:00Z",
      active: false,
    });
    expect(r).toEqual({
      ok: true,
      value: {
        code: "LAUNCH-WEEK",
        description: "Launch",
        duration_days: 30,
        max_redemptions: 100,
        starts_at: "2026-10-20T00:00:00.000Z",
        expires_at: "2026-12-31T23:59:00.000Z",
        active: false,
      },
    });
  });

  it("treats blank strings as unset", () => {
    const r = parseVoucherCreate({ code: "", maxRedemptions: "", startsAt: "", expiresAt: "", durationDays: "" });
    expect(r.ok && r.value).toMatchObject({ max_redemptions: null, starts_at: null, expires_at: null, duration_days: 365 });
  });

  it.each([
    [null, "Invalid body"],
    [{ code: "ab" }, "code must"],
    [{ code: "has space" }, "code must"],
    [{ durationDays: 0 }, "durationDays"],
    [{ durationDays: 3651 }, "durationDays"],
    [{ durationDays: 1.5 }, "durationDays"],
    [{ maxRedemptions: 0 }, "maxRedemptions"],
    [{ maxRedemptions: "10" }, "maxRedemptions"],
    [{ startsAt: "not a date" }, "startsAt"],
    [{ expiresAt: 12 }, "expiresAt"],
    [{ startsAt: "2026-12-01T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z" }, "after startsAt"],
    [{ description: "x".repeat(201) }, "description"],
    [{ active: "yes" }, "active"],
  ])("rejects %p", (body, message) => {
    const r = parseVoucherCreate(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });
});

describe("parseVoucherPatch", () => {
  it("returns only the keys present", () => {
    expect(parseVoucherPatch({ active: false })).toEqual({ ok: true, value: { active: false } });
  });

  it("clears a limit or date with null", () => {
    expect(parseVoucherPatch({ maxRedemptions: null, expiresAt: null })).toEqual({
      ok: true,
      value: { max_redemptions: null, expires_at: null },
    });
  });

  it("ignores code and duration, which are fixed after creation", () => {
    expect(parseVoucherPatch({ code: "NEW", durationDays: 5 })).toEqual({ ok: false, error: "Nothing to update" });
  });

  it.each([
    [{ active: 1 }, "active"],
    [{ maxRedemptions: -1 }, "maxRedemptions"],
    [{ startsAt: "2026-12-01T00:00:00Z", expiresAt: "2026-11-01T00:00:00Z" }, "after startsAt"],
    [{}, "Nothing to update"],
    ["x", "Invalid body"],
  ])("rejects %p", (body, message) => {
    const r = parseVoucherPatch(body);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toContain(message);
  });
});
