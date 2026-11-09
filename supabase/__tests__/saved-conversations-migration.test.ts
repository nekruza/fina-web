/**
 * The saved_conversations migration is applied by hand, so these checks pin
 * the parts that keep transcripts private: saving is off by default, RLS is on,
 * and every policy is limited to the row's owner.
 */
import { readFileSync } from "fs";
import { join } from "path";

const SQL = readFileSync(join(__dirname, "..", "migrations", "20261107010000_saved_conversations.sql"), "utf8");
const normalized = SQL.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

describe("saved_conversations migration", () => {
  it("adds an opt-in save_transcripts column that defaults to off", () => {
    expect(normalized).toContain(
      "alter table public.profiles add column if not exists save_transcripts boolean not null default false"
    );
  });

  it("creates the table owned by auth.users with cascade delete", () => {
    expect(normalized).toContain("create table if not exists public.saved_conversations");
    expect(normalized).toMatch(/user_id uuid not null references auth\.users \(id\) on delete cascade/);
    expect(normalized).toMatch(/messages jsonb not null/);
    expect(normalized).toMatch(/analysis jsonb/);
  });

  it("indexes history by user and newest first", () => {
    expect(normalized).toContain("on public.saved_conversations (user_id, created_at desc)");
  });

  it("enables RLS and limits every operation to the owner", () => {
    expect(normalized).toContain("alter table public.saved_conversations enable row level security");
    for (const op of ["select", "insert", "update", "delete"]) {
      expect(normalized).toMatch(new RegExp(`for ${op} to authenticated`));
    }
    const ownerChecks = normalized.match(/\(select auth\.uid\(\)\) = user_id/g) ?? [];
    // select, delete: using; insert: with check; update: using + with check.
    expect(ownerChecks.length).toBe(5);
  });

  it("gives anon no access", () => {
    expect(normalized).toContain("revoke all on public.saved_conversations from anon");
    expect(normalized).not.toMatch(/grant [^;]* to anon/);
  });
});
