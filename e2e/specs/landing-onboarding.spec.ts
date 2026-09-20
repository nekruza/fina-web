import { test, expect } from "../support/test";
import { signIn } from "../support/auth";

/**
 * The auth entrypoint, full onboarding flow through to signup, and the
 * auth/onboarding gates on `/app`.
 */

test.describe("auth entrypoint", () => {
  test("sends a signed-out visitor at the root to login", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveURL(/\/login/);
  });
});

test.describe("onboarding", () => {
  test("completing every step lands on signup with the return path", async ({ page }) => {
    await page.goto("/onboarding");

    await expect(page.getByRole("heading", { name: "Pick your tutor" })).toBeVisible();
    await page.getByRole("button", { name: "Continue with Luna" }).click();

    await page.getByRole("radio", { name: "Spanish" }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("radio", { name: /I can have simple chats/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("radio", { name: /^Travel:/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();

    await page.getByRole("radio", { name: /^10 min/ }).click();
    await page.getByRole("button", { name: "Build my plan" }).click();

    // The generating step advances itself after ~2.9s — waiting on the
    // reveal's text is the one allowed exception to no arbitrary timeouts.
    await expect(page.getByText("YOUR PLAN IS READY")).toBeVisible({ timeout: 8_000 });
    await page.getByRole("button", { name: "Continue" }).click();

    const consent = page.getByRole("checkbox", {
      name: "I understand and consent to my conversation data and voice audio being processed by the AI services listed above.",
    });
    const createAccount = page.getByRole("button", { name: "Create my account" });

    await expect(createAccount).toBeDisabled();
    await consent.click();
    await expect(createAccount).toBeEnabled();

    await createAccount.click();
    await expect(page).toHaveURL(/\/signup\?next=\/onboarding\/complete/);
  });
});

test.describe("route protection", () => {
  test("a signed-out visitor to /app is sent to login", async ({ page }) => {
    await page.goto("/app");
    await expect(page).toHaveURL(/\/login/);
  });

  test("a signed-in but un-onboarded visitor to /app is sent to onboarding", async ({
    page,
    context,
  }) => {
    await signIn(context, { onboarded: false });
    await page.goto("/app");
    await expect(page).toHaveURL(/\/onboarding/);
  });
});
