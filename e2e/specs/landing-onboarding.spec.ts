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

    const createAccount = page.getByRole("button", { name: "Create my account" });
    await expect(createAccount).toBeDisabled();
    await page.getByRole("radio", { name: /^10 min/ }).click();
    await expect(createAccount).toBeEnabled();

    await createAccount.click();
    await expect(page).toHaveURL(/\/signup\?next=\/onboarding\/complete/);
  });

  test("a signed-in learner finishing setup saves their answers and lands on home", async ({
    page,
    context,
    api,
  }) => {
    await signIn(context, { onboarded: false });
    await page.route("**/api/profile/onboarding", async (r) => {
      // The real handler writes target_language, after which /app stops
      // bouncing to onboarding; the stub reads that from the session token.
      await signIn(context);
      await r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await page.goto("/onboarding");

    await page.getByRole("button", { name: "Continue with Luna" }).click();
    await page.getByRole("radio", { name: "Spanish" }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /I can have simple chats/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /^Travel:/ }).click();
    await page.getByRole("button", { name: "Continue" }).click();
    await page.getByRole("radio", { name: /^10 min/ }).click();
    await page.getByRole("button", { name: "Finish setup" }).click();

    // `next dev` runs the sync effect twice (React StrictMode), so the two
    // runs race and the final redirect is timing-dependent in dev only.
    // Assert the outcome instead: answers posted, local copy cleared, and the
    // learner is now let into /app.
    await expect
      .poll(() => api.calls("/api/profile/onboarding").filter((c) => c.method === "POST").length)
      .toBeGreaterThan(0);
    expect(JSON.parse(api.calls("/api/profile/onboarding")[0].body ?? "{}")).toMatchObject({
      tutor: "luna",
      language: "spanish",
      goal: 10,
    });
    await expect.poll(() => page.evaluate(() => localStorage.getItem("fina_onboarding"))).toBeNull();
    await page.goto("/app");
    await expect(page).toHaveURL(/\/app$/);
  });

  test("a failed profile sync offers a retry that recovers", async ({ page, context }) => {
    await signIn(context, { onboarded: false });
    // Fail until the learner retries — not by attempt count, since dev mode
    // fires the initial sync twice.
    let failing = true;
    await page.route("**/api/profile/onboarding", async (r) => {
      if (failing) {
        return r.fulfill({ status: 500, contentType: "application/json", body: '{"error":"e2e"}' });
      }
      await signIn(context);
      return r.fulfill({ status: 200, contentType: "application/json", body: '{"ok":true}' });
    });
    await page.goto("/onboarding");
    await page.evaluate(() => {
      localStorage.setItem(
        "fina_onboarding",
        JSON.stringify({ tutor: "luna", language: "spanish", level: "intermediate", motivation: "travel", goal: 10 })
      );
    });
    await page.goto("/onboarding/complete");

    await expect(page.getByText("Something went wrong setting up your plan.")).toBeVisible();
    failing = false;
    await page.getByRole("button", { name: "Try again" }).click();

    await expect(page).toHaveURL(/\/app$/);
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
