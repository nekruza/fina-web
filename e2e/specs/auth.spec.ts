import { test, expect } from "../support/test";

/**
 * Sign-in journeys: Google OAuth round trip, email sign-in, the error path,
 * deep-link return, password reset, email signup awaiting confirmation, and
 * the public legal pages.
 *
 * Auth calls from the browser go to the Supabase stub, which answers every
 * token request with the e2e session. Error paths override a single endpoint
 * with `page.route` so the override stays scoped to the test.
 */

test.describe("sign in", () => {
  test("Google sign-in round-trips through the callback and lands on the requested page", async ({
    page,
  }) => {
    await page.goto("/login?next=/app/progress");
    await page.getByRole("button", { name: "Continue with Google" }).click();

    await expect(page).toHaveURL(/\/app\/progress$/);
    await expect(page.getByRole("heading", { name: "Progress", level: 1 })).toBeVisible();
  });

  test("email sign-in lands on the `next` destination", async ({ page }) => {
    await page.goto("/login?next=/app/settings");

    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/app\/settings$/);
    await expect(page.getByLabel("Target language")).toHaveValue("spanish");
  });

  test("a rejected password shows the error and stays on login", async ({ page }) => {
    await page.route("**/auth/v1/token**", (r) =>
      r.fulfill({
        status: 400,
        contentType: "application/json",
        body: JSON.stringify({ error: "invalid_grant", error_description: "Invalid login credentials" }),
      })
    );
    await page.goto("/login");

    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("Password").fill("wrong-password");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page.getByRole("alert").filter({ hasText: "Invalid login credentials" })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("button", { name: "Log in" })).toBeEnabled();
  });

  test("a signed-out deep link keeps its destination through the login redirect", async ({ page }) => {
    await page.goto("/app/progress");

    await expect(page).toHaveURL(/\/login\?next=%2Fapp%2Fprogress$/);
    await page.getByLabel("Email").fill("e2e@example.com");
    await page.getByLabel("Password").fill("correct-horse-battery");
    await page.getByRole("button", { name: "Log in" }).click();

    await expect(page).toHaveURL(/\/app\/progress$/);
  });
});

test.describe("account recovery and signup", () => {
  test("forgot password sends a reset link and confirms without revealing the account", async ({
    page,
  }) => {
    await page.goto("/login");
    await page.getByRole("link", { name: "Forgot password?" }).click();
    await expect(page.getByRole("heading", { name: "Reset password" })).toBeVisible();

    const recover = page.waitForRequest(
      (req) => req.url().includes("/auth/v1/recover") && req.method() === "POST"
    );
    await page.getByLabel("Email").fill("someone@example.com");
    await page.getByRole("button", { name: "Send Reset Link" }).click();

    expect((await recover).postDataJSON()).toMatchObject({ email: "someone@example.com" });
    await expect(page.getByRole("heading", { name: "Check your email" })).toBeVisible();
    await expect(page.getByText(/If an account exists for someone@example\.com/)).toBeVisible();
  });

  test("email signup that needs confirmation asks the user to check their inbox", async ({ page }) => {
    // Supabase returns a bare user (no session) when email confirmation is on.
    await page.route("**/auth/v1/signup**", (r) =>
      r.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          id: "e2e-new-user",
          aud: "authenticated",
          role: "authenticated",
          email: "new@example.com",
          created_at: "2026-01-01T00:00:00.000Z",
          app_metadata: {},
          user_metadata: {},
          identities: [],
        }),
      })
    );
    await page.goto("/signup?next=/onboarding/complete");

    await page.getByLabel("Email").fill("new@example.com");
    await page.getByLabel("Password").fill("a-long-enough-password");
    await page.getByRole("button", { name: "Create account" }).click();

    await expect(
      page.getByRole("heading", { name: "Check your email to confirm your account." })
    ).toBeVisible();
    await expect(page.getByText("new@example.com")).toBeVisible();
  });
});

test.describe("public pages", () => {
  test("privacy policy and terms are readable while signed out and link to each other", async ({
    page,
  }) => {
    await page.goto("/terms");
    await expect(page).toHaveURL(/\/terms$/);
    await expect(page.getByRole("heading", { name: "Terms of Service", level: 1 })).toBeVisible();

    await page.getByRole("link", { name: "Privacy Policy" }).first().click();
    await expect(page).toHaveURL(/\/privacy$/);
    await expect(page.getByRole("heading", { name: "Privacy Policy", level: 1 })).toBeVisible();
    await expect(page.getByText("Third-Party AI Services & Data Sharing")).toBeVisible();
  });
});
