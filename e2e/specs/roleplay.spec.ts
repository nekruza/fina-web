import { test, expect, type Page } from "../support/test";
import { signIn } from "../support/auth";
import { E2E_USER } from "../fixtures/data";

/**
 * The roleplay library: category filters, and the custom-roleplay lifecycle
 * (create, duplicate-title guard, delete). Custom roleplays are read and
 * written straight from the browser to Postgrest, so they are stubbed here.
 */

function customRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "e2e-custom-1",
    user_id: E2E_USER.id,
    title: "Flight cancelled at the gate",
    category: "custom",
    difficulty: "Beginner",
    user_role: "Traveller",
    ai_role: "Gate agent",
    scenario: "I'm at the airport and my flight is cancelled",
    created_at: "2026-09-20T10:00:00.000Z",
    updated_at: "2026-09-20T10:00:00.000Z",
    ...overrides,
  };
}

async function scenarioCount(page: Page): Promise<number> {
  const text = await page.getByText(/^\d+ scenarios? available/).textContent();
  return Number(text?.match(/^(\d+)/)?.[1]);
}

test.describe("roleplay library", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("a category filter narrows the scenarios to that category", async ({ page }) => {
    await page.goto("/app/roleplay");
    const filters = page.getByRole("group", { name: "Filter roleplays" });
    await expect(filters.getByRole("button", { name: "All" })).toHaveAttribute("aria-pressed", "true");
    const all = await scenarioCount(page);

    await filters.getByRole("button", { name: "Food" }).click();

    await expect(filters.getByRole("button", { name: "Food" })).toHaveAttribute("aria-pressed", "true");
    await expect.poll(() => scenarioCount(page)).toBeLessThan(all);
    await expect(page.getByText("Ordering at Restaurant").first()).toBeVisible();
    await expect(page.locator('a[href*="roleplay=travel-directions-1"]')).toHaveCount(0);
  });
});

test.describe("custom roleplays", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("creating one from a suggestion saves it and shows it under Custom", async ({ page }) => {
    let created = false;
    await page.route("**/rest/v1/custom_roleplays**", (r) => {
      const req = r.request();
      const json = (body: unknown, status = 200) =>
        r.fulfill({ status, contentType: "application/json", body: JSON.stringify(body) });
      if (req.method() === "POST") {
        created = true;
        return json({ id: "e2e-custom-1" }, 201);
      }
      // The duplicate-title check uses `.single()`; nothing exists yet.
      if ((req.headers()["accept"] ?? "").includes("vnd.pgrst.object+json")) return json(null);
      return json(created ? [customRow({ title: "I'm at the airport and my flight is cancelled" })] : []);
    });
    await page.goto("/app/roleplay");
    await page.getByRole("link", { name: "Create custom roleplay" }).click();
    await expect(page.getByRole("heading", { name: "What are we practicing?" })).toBeVisible();

    const submit = page.getByRole("button", { name: "Set the scene" });
    await expect(submit).toBeDisabled();

    await page.getByRole("button", { name: /I'm at the airport and my flight is cancelled/ }).click();
    await expect(page.getByLabel("Title")).toHaveValue("I'm at the airport and my flight is cancelled");
    await page.getByLabel("You are").fill("Traveller");
    await page.getByLabel("AI is").fill("Gate agent");
    await page.getByRole("button", { name: "Intermediate" }).click();

    const insert = page.waitForRequest(
      (req) => req.url().includes("/rest/v1/custom_roleplays") && req.method() === "POST"
    );
    await submit.click();

    expect((await insert).postDataJSON()).toMatchObject({
      title: "I'm at the airport and my flight is cancelled",
      user_role: "Traveller",
      ai_role: "Gate agent",
      difficulty: "Intermediate",
      category: "custom",
    });
    await expect(page).toHaveURL(/\/app\/roleplay\?filter=custom$/);
    await expect(
      page.getByRole("group", { name: "Filter roleplays" }).getByRole("button", { name: "Custom" })
    ).toHaveAttribute("aria-pressed", "true");
    await expect(page.getByText("I'm at the airport and my flight is cancelled").first()).toBeVisible();
  });

  test("a title that already exists is rejected before saving", async ({ page, api }) => {
    await api.table("custom_roleplays", [customRow()]);
    await page.goto("/app/roleplay/new");

    await page.getByLabel("Scenario").fill("My flight was cancelled and I need a new one");
    await page.getByLabel("Title").fill("Flight cancelled at the gate");
    await page.getByLabel("You are").fill("Traveller");
    await page.getByLabel("AI is").fill("Gate agent");

    const inserts: string[] = [];
    page.on("request", (req) => {
      if (req.url().includes("/rest/v1/custom_roleplays") && req.method() === "POST") inserts.push(req.url());
    });
    await page.getByRole("button", { name: "Set the scene" }).click();

    await expect(
      page.getByRole("alert").filter({ hasText: "You already have a roleplay with this title." })
    ).toBeVisible();
    await expect(page).toHaveURL(/\/app\/roleplay\/new$/);
    expect(inserts).toHaveLength(0);
  });

  test("deleting one asks for confirmation and removes it", async ({ page, api }) => {
    await api.table("custom_roleplays", [customRow()]);
    await page.goto("/app/roleplay?filter=custom");
    await expect(page.getByText("(1 custom)")).toBeVisible();

    await page.getByRole("button", { name: "Delete Flight cancelled at the gate" }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog.getByRole("heading", { name: "Delete roleplay?" })).toBeVisible();
    await expect(dialog).toContainText("Flight cancelled at the gate");

    const remove = page.waitForRequest(
      (req) => req.url().includes("/rest/v1/custom_roleplays") && req.method() === "DELETE"
    );
    await dialog.getByRole("button", { name: "Delete", exact: true }).click();

    expect((await remove).url()).toContain("id=eq.e2e-custom-1");
    await expect(page.getByText("Roleplay deleted")).toBeVisible();
    await expect(dialog).toBeHidden();
  });
});
