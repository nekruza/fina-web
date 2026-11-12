/**
 * The english_uk migration is applied by hand, so these checks pin that it
 * widens profiles_target_language_check without dropping any value the table
 * already accepts (including turkish, which the mobile app writes).
 */
import { readFileSync } from "fs";
import { join } from "path";

const SQL = readFileSync(join(__dirname, "..", "migrations", "20261107000000_english_uk.sql"), "utf8");
const normalized = SQL.replace(/--.*$/gm, "").replace(/\s+/g, " ").toLowerCase();

describe("english_uk migration", () => {
  it("replaces the constraint idempotently", () => {
    expect(normalized).toContain("alter table public.profiles drop constraint if exists profiles_target_language_check");
    expect(normalized).toContain("alter table public.profiles add constraint profiles_target_language_check");
  });

  it("allows every language the web app offered at the time plus the ids already in the database", () => {
    // Later migrations (e.g. czech) widen the constraint further; this one is frozen.
    const ids = ["english", "english_uk", "spanish", "french", "german", "chinese", "japanese", "portuguese", "russian", "arabic", "turkish"];
    for (const id of ids) {
      expect(normalized).toContain(`'${id}'`);
    }
  });
});
