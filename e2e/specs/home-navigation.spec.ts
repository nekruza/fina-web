import { test, expect, type Page } from "../support/test";
import { signIn } from "../support/auth";

/**
 * Feedback is a "Share feedback" quick action on desktop and a separate
 * "Give us feedback" card below the content on mobile; only one is visible.
 */
function feedbackButton(page: Page) {
  return page.getByRole("button", { name: /Share feedback|Give us feedback/ }).filter({ visible: true });
}

/**
 * The signed-in home dashboard: greeting, streak, today's plan, quick
 * actions, primary navigation, and the feedback dialog.
 */

test.describe("home", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("shows a greeting, the streak, today's plan, and quick actions", async ({ page }) => {
    await page.goto("/app");

    await expect(
      page.getByRole("heading", { level: 1, name: /Good (morning|afternoon|evening), E2E/ })
    ).toBeVisible();
    await expect(page.getByText(/2\s*🔥/)).toBeVisible();
    await expect(page.getByText("Today’s Plan")).toBeVisible();

    await expect(page.getByRole("link", { name: /Start speaking/ })).toBeVisible();
    // "Words" alone is ambiguous with the "Words" nav label, which is present
    // (if not visible) in both the desktop sidebar and the mobile bottom nav
    // regardless of viewport — match the quick-action card by its full text instead.
    await expect(page.getByRole("link", { name: /Words.*manage your vocabulary/i })).toBeVisible();
    await expect(feedbackButton(page)).toBeVisible();
  });

  test("reaches Roleplay from the primary navigation", async ({ page }) => {
    await page.goto("/app");
    // The desktop sidebar and mobile bottom nav are both real `<nav>`
    // elements and both render every link; only one is visible per viewport
    // (the other is `hidden`/`md:hidden`). Scoping to `nav` excludes the
    // (also real, also visible) content links that happen to share an href,
    // e.g. the streak card and quick-action tile also link to /app/roleplay.
    await page.locator('nav a[href="/app/roleplay"]:visible').click();
    await expect(page.getByRole("heading", { name: "Roleplay" })).toBeVisible();
  });

  test("reaches Vocabulary from the primary navigation", async ({ page }) => {
    await page.goto("/app");
    await page.locator('nav a[href="/app/vocabulary"]:visible').click();
    await expect(page).toHaveURL(/\/app\/vocabulary$/);
    await expect(page.getByText("Words by Topic")).toBeVisible();
  });

  test("reaches the 30-day plan from the primary navigation", async ({ page }) => {
    await page.goto("/app");
    await page.locator('nav a[href="/app/study-plan"]:visible').click();
    await expect(page.getByRole("heading", { name: "Your 30-Day Plan" })).toBeVisible();
  });

  test("reaches Progress from the primary navigation", async ({ page }) => {
    await page.goto("/app");
    await page.locator('nav a[href="/app/progress"]:visible').click();
    await expect(page).toHaveURL(/\/app\/progress$/);
  });

  test("submits the feedback dialog", async ({ page, api }) => {
    await api.table("feedback", []);
    await page.goto("/app");

    await feedbackButton(page).click();
    await expect(page.getByRole("heading", { name: "Share your feedback" })).toBeVisible();

    await page.getByPlaceholder(/Tell us what you think/i).fill("Loving the app so far!");
    await page.getByRole("button", { name: "Submit feedback" }).click();

    await expect(page.getByText("Thanks for your feedback")).toBeVisible();
  });

  test("keeps feedback out of the mobile navigation and places it below the home content", async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto("/app");

    const mobileNavigation = page.getByRole("navigation", { name: "Mobile navigation" });
    await expect(mobileNavigation.getByRole("button", { name: "Feedback" })).toHaveCount(0);

    const feedback = page.getByRole("button", { name: "Give us feedback" });
    await expect(feedback).toBeVisible();
    await expect(feedback.locator("xpath=ancestor::main")).toHaveCount(1);
  });
});
