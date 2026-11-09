import { test, expect, analysisFixture, hintsFixture, profileFixture, usageFixture } from "../support/test";
import { signIn } from "../support/auth";

/**
 * The voice-roleplay conversation loop: setup, starting, the live controls,
 * hints, ending, and the graded results.
 */

const ROLEPLAY_URL = "/app/conversation?roleplay=food-restaurant-1&tutor=luna";

test.describe("conversation setup", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("a roleplay card opens the matching setup page", async ({ page }) => {
    await page.goto("/app/roleplay");
    await page
      .locator('a[href="/app/conversation?roleplay=food-restaurant-1&tutor=luna"]')
      .first()
      .click();

    await expect(page).toHaveURL(/\/app\/conversation\?roleplay=food-restaurant-1&tutor=luna/);
    await expect(page.getByRole("heading", { name: "Ordering at Restaurant" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Start conversation" })).toBeVisible();
  });

  test("starting posts the roleplay id to /api/conversations", async ({ page, api }) => {
    await page.goto(ROLEPLAY_URL);
    await page.getByRole("button", { name: "Start conversation" }).click();

    await expect
      .poll(() =>
        api
          .calls("/api/conversations")
          .filter((c) => c.method === "POST" && (c.body ?? "").includes("food-restaurant-1")).length
      )
      .toBeGreaterThan(0);
  });

  test("a free user with no conversations left sees the Pro dialog instead", async ({
    page,
    api,
  }) => {
    await api.json("**/api/conversations/usage", usageFixture(0, false));
    await page.goto(ROLEPLAY_URL);
    await page.getByRole("button", { name: "Start conversation" }).click();

    await expect(
      page.getByRole("heading", { name: "You've used your free conversations" })
    ).toBeVisible();
  });
});

test.describe("running a conversation", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  async function start(page: import("@playwright/test").Page) {
    await page.goto(ROLEPLAY_URL);
    await page.getByRole("button", { name: "Start conversation" }).click();
    await expect(page.getByRole("button", { name: "End Session" })).toBeVisible();
  }

  test("shows the live controls and a running timer", async ({ page }) => {
    await start(page);

    await expect(page.getByRole("button", { name: "Get Hint" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Type a message" })).toBeVisible();
    await expect(page.getByText(/\d{2}:\d{2}/)).toBeVisible();
  });

  test("Get Hint shows suggested replies from the AI", async ({ page }) => {
    await start(page);

    await page.getByRole("button", { name: "Get Hint" }).click();
    await expect(page.getByRole("heading", { name: "You can say:" })).toBeVisible();
    await expect(page.getByText(hintsFixture[0])).toBeVisible();
  });

  test("ending asks for confirmation before completing", async ({ page }) => {
    await start(page);

    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByRole("heading", { name: "End conversation" })).toBeVisible();
    await expect(page.getByText("We'll analyze your conversation.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Cancel" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Complete" })).toBeVisible();
  });

  test("completing grades the conversation and shows the results", async ({ page, api }) => {
    await start(page);

    await page.getByRole("button", { name: "End Session" }).click();
    await page.getByRole("button", { name: "Complete" }).click();

    await expect.poll(() => api.calls("/api/ai/feedback").length).toBeGreaterThan(0);

    await expect(page.getByText("Overall")).toBeVisible();
    await expect(page.getByText(analysisFixture().summary)).toBeVisible();
    await expect(page.getByText("Fluency")).toBeVisible();
    await expect(page.getByText("Grammar")).toBeVisible();
    await expect(page.getByText(/3\s*days?\s*streak/)).toBeVisible();
  });

  async function finishAfterGreeting(page: import("@playwright/test").Page) {
    await start(page);
    // The tutor's greeting is in the transcript once it's the learner's turn.
    await expect(page.getByRole("button", { name: "Type a message" })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("button", { name: "End Session" }).click();
    await page.getByRole("button", { name: "Complete" }).click();
  }

  const putsTo = (api: { calls: (s: string) => Array<{ method: string; body: string | null }> }) =>
    api.calls("/api/conversations/e2e-conv-1").filter((c) => c.method === "PUT");

  test("with saving off, the results show the transcript and offer to keep it", async ({ page, api }) => {
    await finishAfterGreeting(page);

    await expect(page.getByRole("heading", { name: "Transcript" })).toBeVisible();
    await expect(page.getByRole("list", { name: "Transcript" })).toContainText("¡Hola! Bienvenido");
    await expect(page.getByText("This transcript disappears when you leave this page.")).toBeVisible();
    expect(putsTo(api)).toHaveLength(0);

    await page.getByRole("button", { name: "Keep my transcripts" }).click();

    await expect(page.getByText(/Saved\. Read it again anytime in/)).toBeVisible();
    const patch = api.calls("/api/profile").find((c) => c.method === "PATCH");
    expect(JSON.parse(patch?.body ?? "{}")).toEqual({ saveTranscripts: true });
    await expect.poll(() => putsTo(api).length).toBeGreaterThan(0);
    expect(putsTo(api)[0].body).toContain("¡Hola! Bienvenido");
  });

  test("with saving on, the transcript and its feedback are saved without asking", async ({ page, api }) => {
    await page.route("**/api/profile", (r) =>
      r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(profileFixture({ saveTranscripts: true })) })
    );

    await page.goto(ROLEPLAY_URL);
    await page.getByRole("button", { name: "Start conversation" }).click();
    await expect(page.getByRole("button", { name: "Type a message" })).toBeEnabled({ timeout: 15_000 });
    await page.getByRole("button", { name: "End Session" }).click();
    await expect(page.getByText("We'll analyze your conversation and save the transcript.")).toBeVisible();
    await page.getByRole("button", { name: "Complete" }).click();

    await expect(page.getByText(/Saved\. Read it again anytime in/)).toBeVisible();
    await expect.poll(() => putsTo(api).some((c) => (c.body ?? "").includes('"analysis"'))).toBe(true);
    expect(putsTo(api)[0].body).toContain("¡Hola! Bienvenido");
  });

  test("a typed reply is sent to the tutor in place of speech", async ({ page, api }) => {
    await start(page);

    // Typing is only enabled once the tutor's greeting is done and it's the learner's turn.
    const typeToggle = page.getByRole("button", { name: "Type a message" });
    await expect(typeToggle).toBeEnabled({ timeout: 15_000 });
    await typeToggle.click();

    const input = page.getByRole("textbox", { name: "Type a message" });
    await input.fill("Quisiera la sopa del día, por favor.");
    await page.getByRole("button", { name: "Send", exact: true }).click();

    await expect(input).toBeHidden();
    await expect
      .poll(() =>
        api
          .calls("/api/ai/voice")
          .filter((c) => (c.body ?? "").includes("Quisiera la sopa del día, por favor.")).length
      )
      .toBeGreaterThan(0);
  });

  test("still reaches the results page if grading fails", async ({ page, api }) => {
    await api.fail("**/api/ai/feedback", 500);
    await start(page);

    await page.getByRole("button", { name: "End Session" }).click();
    await page.getByRole("button", { name: "Complete" }).click();

    await expect(page.getByRole("button", { name: "Practice again" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Choose another scenario" })).toBeVisible();
    await expect(page.getByRole("link", { name: "Back to home" })).toBeVisible();
  });
});
