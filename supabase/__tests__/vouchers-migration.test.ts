/**
 * Like migration.test.ts: the vouchers migration is applied by hand, so these
 * checks pin the statements that keep codes private and redemption atomic.
 */
import { readFileSync } from "fs";
import { join } from "path";

const SQL = readFileSync(join(__dirname, "..", "migrations", "20261018000000_vouchers.sql"), "utf8");
const normalized = SQL.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

describe("voucher tables", () => {
  it("creates both tables idempotently", () => {
    expect(normalized).toContain("create table if not exists public.voucher_codes");
    expect(normalized).toContain("create table if not exists public.voucher_redemptions");
  });

  it("allows each user to redeem a code only once", () => {
    expect(normalized).toContain("unique (voucher_id, user_id)");
  });

  it("keeps redeemed codes from being deleted", () => {
    expect(normalized).toContain("references public.voucher_codes (id) on delete restrict");
  });

  it.each(["voucher_codes", "voucher_redemptions"])("locks %s down to the service role", (table) => {
    expect(normalized).toContain(`alter table public.${table} enable row level security`);
    expect(normalized).toContain(`revoke all on public.${table} from anon, authenticated`);
    expect(normalized).not.toMatch(new RegExp(`create policy [^;]* on public\\.${table}`));
  });
});

describe("redeem_voucher", () => {
  it("is security definer with a pinned search_path", () => {
    expect(normalized).toContain("create or replace function public.redeem_voucher(p_code text, p_user_id uuid)");
    expect(normalized).toMatch(/security definer set search_path = public/);
  });

  it("is executable only by the service role", () => {
    expect(normalized).toContain(
      "revoke all on function public.redeem_voucher(text, uuid) from public, anon, authenticated"
    );
    expect(normalized).toContain("grant execute on function public.redeem_voucher(text, uuid) to service_role");
  });

  it("locks the voucher and profile rows so limits can't be overshot", () => {
    expect(normalized).toMatch(/from public\.voucher_codes where code = upper\(btrim\(p_code\)\) for update/);
    expect(normalized).toMatch(/from public\.profiles where id = p_user_id for update/);
  });

  it("checks every rule before granting", () => {
    for (const status of [
      "invalid",
      "not_started",
      "expired",
      "already_redeemed",
      "exhausted",
      "no_profile",
      "has_subscription",
      "already_pro",
    ]) {
      expect(normalized).toContain(`'status', '${status}'`);
    }
    expect(normalized).toContain("v.redemption_count >= v.max_redemptions");
  });

  it("grants Pro for duration_days and detaches any ended Stripe subscription", () => {
    expect(normalized).toContain("v_until := now() + make_interval(days => v.duration_days)");
    expect(normalized).toContain(
      "set pro_status = 'active', pro_current_period_end = v_until, stripe_subscription_id = null"
    );
    expect(normalized).toContain("set redemption_count = redemption_count + 1");
  });
});
