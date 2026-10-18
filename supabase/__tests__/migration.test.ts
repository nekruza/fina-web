/**
 * The migration is applied by hand in the Supabase SQL editor, so nothing in
 * CI ever executes it. These checks pin the security-relevant statements so a
 * later edit can't silently drop them.
 */
import { readFileSync } from "fs";
import { join } from "path";

const SQL = readFileSync(join(__dirname, "..", "migrations", "20260913000000_fina_web.sql"), "utf8");
const normalized = SQL.replace(/\s+/g, " ").toLowerCase();

const BILLING_COLUMNS = ["pro_status", "pro_current_period_end", "stripe_customer_id", "stripe_subscription_id"];

describe("profiles billing-column protection (C1)", () => {
  it("defines the guard function idempotently as security definer with a pinned search_path", () => {
    expect(normalized).toContain("create or replace function public.protect_profile_billing_columns()");
    expect(normalized).toMatch(/security definer/);
    expect(normalized).toMatch(/set search_path = public/);
  });

  it("recreates the trigger idempotently, before insert or update on profiles", () => {
    expect(normalized).toContain(
      "drop trigger if exists protect_profile_billing_columns on public.profiles"
    );
    expect(normalized).toContain(
      "create trigger protect_profile_billing_columns before insert or update on public.profiles for each row execute function public.protect_profile_billing_columns()"
    );
  });

  it("can't be called directly through the REST API", () => {
    expect(normalized).toContain(
      "revoke all on function public.protect_profile_billing_columns() from public, anon, authenticated"
    );
  });

  it("treats the service role and the dashboard/SQL-editor roles as privileged", () => {
    expect(normalized).toContain("coalesce(auth.role(), '') = 'service_role'");
    expect(normalized).toMatch(/session_user in \('postgres', 'supabase_admin', 'service_role'\)/);
  });

  it.each(BILLING_COLUMNS)("nulls %s on insert and pins it to the old value on update", (col) => {
    expect(normalized).toContain(`new.${col} := null;`);
    expect(normalized).toContain(`new.${col} := old.${col};`);
  });
});

describe("current schema boundaries", () => {
  it("does not create web-only conversation or generation-event tables", () => {
    expect(normalized).not.toContain("conversation_sessions");
    expect(normalized).not.toContain("vocabulary_generation_events");
  });
});
