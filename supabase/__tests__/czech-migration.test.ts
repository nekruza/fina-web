/**
 * The czech migration is applied by hand, so these checks pin that it widens
 * profiles_target_language_check to every language the web app offers without
 * dropping any value the table already accepts (including turkish, which the
 * mobile app writes).
 */
import { readFileSync } from "fs";
import { join } from "path";
import { LANGUAGES } from "@/lib/languages";

const SQL = readFileSync(join(__dirname, "..", "migrations", "20261111000000_czech.sql"), "utf8");
const normalized = SQL.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

describe("czech migration", () => {
  it("replaces the constraint idempotently", () => {
    expect(normalized).toContain("alter table public.profiles drop constraint if exists profiles_target_language_check");
    expect(normalized).toContain("alter table public.profiles add constraint profiles_target_language_check");
  });

  it("allows every language the web app offers plus the ids already in the database", () => {
    for (const id of [...LANGUAGES.map((l) => l.id), "turkish"]) {
      expect(normalized).toContain(`'${id}'`);
    }
  });
});
