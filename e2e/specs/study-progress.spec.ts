import { test, expect, analysisFixture } from "../support/test";
import { signIn } from "../support/auth";

/**
 * The 30-day plan's deep links into practice, and the Progress page's stats
 * and conversation history.
 */

test.describe("study plan", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("a day's Speak link opens that day's roleplay with the learner's tutor", async ({ page }) => {
    await page.goto("/app/study-plan");
    await expect(page.getByRole("heading", { name: "Your 30-Day Plan" })).toBeVisible();
    await expect(page.getByText(/^Day \d+ of 30$/)).toBeVisible();

    await page.getByRole("link", { name: "Practice speaking: Ordering at a Restaurant" }).click();

    await expect(page).toHaveURL(/\/app\/conversation\?roleplay=food-restaurant-1&tutor=luna$/);
    await expect(page.getByRole("heading", { name: "Ordering at Restaurant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start conversation" })).toBeVisible();
  });
});

test.describe("progress", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("shows profile stats and expands a past conversation to its corrections", async ({ page }) => {
    const analysis = analysisFixture();
    // Matched by pathname: the page asks for `/api/conversations?limit=20`,
    // which the default glob in the `api` fixture does not cover.
    await page.route(
      (url) => url.pathname === "/api/conversations",
      (r) =>
        r.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            sessions: [
              {
                id: "e2e-session-1",
                roleplayId: "food-restaurant-1",
                roleplayTitle: "Ordering at Restaurant",
                tutorId: "luna",
                language: "spanish",
                level: "intermediate",
                status: "completed",
                startedAt: "2026-09-14T10:00:00.000Z",
                completedAt: "2026-09-14T10:05:00.000Z",
                durationSeconds: 300,
                overallScore: analysis.overall,
                analysis,
                messageCount: 8,
              },
            ],
          }),
        })
    );
    await page.goto("/app/progress");

    const tile = (label: string) => page.getByText(label, { exact: true }).locator("..");
    await expect(tile("Conversations")).toContainText("4");
    await expect(tile("Avg score")).toContainText("78");
    await expect(tile("Lessons completed")).toContainText("2");

    const row = page.getByRole("button", { name: /Ordering at Restaurant/ });
    await expect(row).toHaveAttribute("aria-expanded", "false");
    await expect(row).toContainText("Sep 14, 2026");
    await expect(row).toContainText(String(analysis.overall));

    await row.click();

    await expect(row).toHaveAttribute("aria-expanded", "true");
    await expect(page.getByText(analysis.summary)).toBeVisible();
    await expect(page.locator("del", { hasText: "Yo tiene hambre" })).toBeVisible();
    await expect(page.locator("ins", { hasText: "Yo tengo hambre" })).toBeVisible();
  });
});
