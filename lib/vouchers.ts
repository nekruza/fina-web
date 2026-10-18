/**
 * Voucher codes that grant Fina Pro for a fixed period without Stripe.
 *
 * Validation, limits and the Pro grant itself live in the `redeem_voucher`
 * Postgres function (see supabase/migrations/20261018000000_vouchers.sql);
 * this module holds the shared shapes, input parsing for the admin API, and
 * the user-facing copy for each redeem outcome.
 */
export const DEFAULT_VOUCHER_DAYS = 365;
export const MAX_VOUCHER_DAYS = 3650;
export const MAX_DESCRIPTION_LENGTH = 200;

/** Mirrors the `code` check constraint on `voucher_codes`. */
const CODE_PATTERN = /^[A-Z0-9_-]{4,40}$/;

/** No 0/O or 1/I/L, so a code read aloud or off a screenshot is unambiguous. */
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export interface VoucherCodeRow {
  id: string;
  code: string;
  description: string | null;
  duration_days: number;
  max_redemptions: number | null;
  redemption_count: number;
  starts_at: string | null;
  expires_at: string | null;
  active: boolean;
  created_at: string;
  updated_at: string;
}

export type RedeemStatus =
  | "ok"
  | "invalid"
  | "not_started"
  | "expired"
  | "exhausted"
  | "already_redeemed"
  | "already_pro"
  | "has_subscription"
  | "no_profile";

/** HTTP status and message for each non-ok outcome of `redeem_voucher`. */
export const REDEEM_ERRORS: Record<Exclude<RedeemStatus, "ok">, { status: number; message: string }> = {
  invalid: { status: 404, message: "That code isn't valid." },
  not_started: { status: 409, message: "That code isn't active yet." },
  expired: { status: 410, message: "That code has expired." },
  exhausted: { status: 410, message: "That code has reached its usage limit." },
  already_redeemed: { status: 409, message: "You've already used this code." },
  already_pro: { status: 409, message: "You already have Fina Pro." },
  has_subscription: {
    status: 409,
    message: "You have an active subscription. Cancel it in Manage subscription before redeeming a code.",
  },
  no_profile: { status: 409, message: "Finish setting up your account before redeeming a code." },
};

export function isRedeemStatus(v: unknown): v is RedeemStatus {
  return v === "ok" || (typeof v === "string" && Object.hasOwn(REDEEM_ERRORS, v));
}

export function normalizeVoucherCode(raw: string): string {
  return raw.trim().toUpperCase();
}

export function isValidVoucherCode(code: string): boolean {
  return CODE_PATTERN.test(code);
}

/** A random code like `FINA-7KQ2-M9XD`. 31^8 combinations, so not guessable. */
export function generateVoucherCode(prefix = "FINA"): string {
  // Web Crypto, so this module stays importable from client components.
  // The modulo bias over 2^32 for a 31-letter alphabet is negligible.
  const group = () =>
    Array.from(crypto.getRandomValues(new Uint32Array(4)), (n) => CODE_ALPHABET[n % CODE_ALPHABET.length]).join("");
  return `${prefix}-${group()}-${group()}`;
}

/** Live state of a code, for the admin list. Mirrors the checks in `redeem_voucher`. */
export function voucherState(
  v: Pick<VoucherCodeRow, "active" | "starts_at" | "expires_at" | "max_redemptions" | "redemption_count">,
  now: Date = new Date()
): "active" | "disabled" | "scheduled" | "expired" | "used_up" {
  if (!v.active) return "disabled";
  if (v.expires_at && new Date(v.expires_at).getTime() <= now.getTime()) return "expired";
  if (v.max_redemptions !== null && v.redemption_count >= v.max_redemptions) return "used_up";
  if (v.starts_at && new Date(v.starts_at).getTime() > now.getTime()) return "scheduled";
  return "active";
}

type ParseResult<T> = { ok: true; value: T } | { ok: false; error: string };

export type VoucherCreate = Pick<
  VoucherCodeRow,
  "code" | "description" | "duration_days" | "max_redemptions" | "starts_at" | "expires_at" | "active"
>;
export type VoucherPatch = Partial<Omit<VoucherCreate, "code" | "duration_days">>;

function parseOptionalDate(v: unknown, field: string): ParseResult<string | null> {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "string" || Number.isNaN(new Date(v).getTime())) {
    return { ok: false, error: `${field} must be a date` };
  }
  return { ok: true, value: new Date(v).toISOString() };
}

function parseMaxRedemptions(v: unknown): ParseResult<number | null> {
  if (v === null || v === undefined || v === "") return { ok: true, value: null };
  if (typeof v !== "number" || !Number.isInteger(v) || v < 1) {
    return { ok: false, error: "maxRedemptions must be a whole number of at least 1, or empty for unlimited" };
  }
  return { ok: true, value: v };
}

function parseDescription(v: unknown): ParseResult<string | null> {
  if (v === null || v === undefined) return { ok: true, value: null };
  if (typeof v !== "string" || v.trim().length > MAX_DESCRIPTION_LENGTH) {
    return { ok: false, error: `description must be at most ${MAX_DESCRIPTION_LENGTH} characters` };
  }
  return { ok: true, value: v.trim() || null };
}

function checkDateOrder(startsAt: string | null, expiresAt: string | null): string | null {
  if (startsAt && expiresAt && new Date(expiresAt) <= new Date(startsAt)) {
    return "expiresAt must be after startsAt";
  }
  return null;
}

/**
 * Parses the admin create body (camelCase). A blank `code` generates one.
 * Only `code` and `durationDays` are fixed after creation; everything else
 * can be changed later with `parseVoucherPatch`.
 */
export function parseVoucherCreate(body: unknown): ParseResult<VoucherCreate> {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;

  let code: string;
  if (b.code === undefined || b.code === null || b.code === "") {
    code = generateVoucherCode();
  } else if (typeof b.code === "string" && isValidVoucherCode(normalizeVoucherCode(b.code))) {
    code = normalizeVoucherCode(b.code);
  } else {
    return { ok: false, error: "code must be 4–40 letters, digits, - or _" };
  }

  let durationDays = DEFAULT_VOUCHER_DAYS;
  if (b.durationDays !== undefined && b.durationDays !== null && b.durationDays !== "") {
    if (
      typeof b.durationDays !== "number" ||
      !Number.isInteger(b.durationDays) ||
      b.durationDays < 1 ||
      b.durationDays > MAX_VOUCHER_DAYS
    ) {
      return { ok: false, error: `durationDays must be a whole number from 1 to ${MAX_VOUCHER_DAYS}` };
    }
    durationDays = b.durationDays;
  }

  const description = parseDescription(b.description);
  if (!description.ok) return description;
  const maxRedemptions = parseMaxRedemptions(b.maxRedemptions);
  if (!maxRedemptions.ok) return maxRedemptions;
  const startsAt = parseOptionalDate(b.startsAt, "startsAt");
  if (!startsAt.ok) return startsAt;
  const expiresAt = parseOptionalDate(b.expiresAt, "expiresAt");
  if (!expiresAt.ok) return expiresAt;
  const orderError = checkDateOrder(startsAt.value, expiresAt.value);
  if (orderError) return { ok: false, error: orderError };

  if (b.active !== undefined && typeof b.active !== "boolean") return { ok: false, error: "active must be a boolean" };

  return {
    ok: true,
    value: {
      code,
      description: description.value,
      duration_days: durationDays,
      max_redemptions: maxRedemptions.value,
      starts_at: startsAt.value,
      expires_at: expiresAt.value,
      active: b.active ?? true,
    },
  };
}

/**
 * Parses the admin update body. Only keys present in the body are returned,
 * so a PATCH of `{ active: false }` leaves every other column alone. The
 * date-order check only sees the dates in this body; the table's check
 * constraint covers a patch that moves one date past the stored other one.
 */
export function parseVoucherPatch(body: unknown): ParseResult<VoucherPatch> {
  if (!body || typeof body !== "object") return { ok: false, error: "Invalid body" };
  const b = body as Record<string, unknown>;
  const patch: VoucherPatch = {};

  if ("active" in b) {
    if (typeof b.active !== "boolean") return { ok: false, error: "active must be a boolean" };
    patch.active = b.active;
  }
  if ("description" in b) {
    const r = parseDescription(b.description);
    if (!r.ok) return r;
    patch.description = r.value;
  }
  if ("maxRedemptions" in b) {
    const r = parseMaxRedemptions(b.maxRedemptions);
    if (!r.ok) return r;
    patch.max_redemptions = r.value;
  }
  if ("startsAt" in b) {
    const r = parseOptionalDate(b.startsAt, "startsAt");
    if (!r.ok) return r;
    patch.starts_at = r.value;
  }
  if ("expiresAt" in b) {
    const r = parseOptionalDate(b.expiresAt, "expiresAt");
    if (!r.ok) return r;
    patch.expires_at = r.value;
  }

  const orderError = checkDateOrder(patch.starts_at ?? null, patch.expires_at ?? null);
  if (orderError) return { ok: false, error: orderError };
  if (Object.keys(patch).length === 0) return { ok: false, error: "Nothing to update" };

  return { ok: true, value: patch };
}
