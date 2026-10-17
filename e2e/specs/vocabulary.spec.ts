import { test, expect, lessonFixture } from "../support/test";
import { signIn } from "../support/auth";

/**
 * Vocabulary: the hub, the topic list + search, a flashcard lesson, AI word
 * generation, and the favorites empty state.
 */

test.describe("vocabulary hub", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("shows the three entry points", async ({ page }) => {
    await page.goto("/app/vocabulary");

    await expect(page.getByText("Words by Topic")).toBeVisible();
    await expect(page.getByText("Generate Words")).toBeVisible();
    await expect(page.getByText("Favorites")).toBeVisible();
  });
});

test.describe("lessons list", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("shows lessons for the learner's target language and filters by search", async ({
    page,
  }) => {
    await page.goto("/app/vocabulary/lessons");

    await expect(page.getByText("Daily Life")).toBeVisible();

    await page.getByRole("searchbox", { name: "Search topics" }).fill("zzzqqqxxx-nomatch");
    await expect(page.getByText("Topic not found")).toBeVisible();
  });

  test("opening a lesson shows the flashcard deck and Next advances it", async ({ page }) => {
    await page.goto("/app/vocabulary/lessons");
    await page.getByText("Daily Life").click();

    await expect(page).toHaveURL(/\/app\/vocabulary\/lessons\/1$/);
    await expect(page.getByText("1 of 20")).toBeVisible();

    await page.getByRole("button", { name: "Next word" }).click();
    await expect(page.getByText("2 of 20")).toBeVisible();

    await page.getByRole("button", { name: "Previous word" }).click();
    await expect(page.getByText("1 of 20")).toBeVisible();
  });

  test("Play pronunciation requests text-to-speech", async ({ page, api }) => {
    await page.goto("/app/vocabulary/lessons");
    await page.getByText("Daily Life").click();
    await expect(page.getByText("1 of 20")).toBeVisible();

    await page.getByRole("button", { name: "Play pronunciation" }).click();

    await expect.poll(() => api.calls("/api/tts").length).toBeGreaterThan(0);
  });
});

test.describe("studying a lesson", () => {
  const lesson = lessonFixture();
  const lessonUrl = `/app/vocabulary/lessons/g-${lesson.supabaseId}`;

  test.beforeEach(async ({ context, api }) => {
    await signIn(context);
    await api.table("generated_lessons", [{ id: lesson.supabaseId, lesson_data: lesson }]);
  });

  test("working through every card completes the lesson and records it", async ({ page }) => {
    await page.goto(lessonUrl);
    await expect(page.getByText("1 of 2")).toBeVisible();

    await page.getByRole("button", { name: "Next word" }).click();
    await expect(page.getByText("2 of 2")).toBeVisible();
    await page.getByRole("button", { name: "Next word" }).click();

    await expect(page.getByRole("heading", { name: "Lesson complete! 🎉" })).toBeVisible();
    await expect(page.getByText(`You've learned 2 new words in ${lesson.title}`)).toBeVisible();

    const progress = page.waitForRequest(
      (req) => req.url().includes("/rest/v1/lesson_progress") && req.method() === "POST"
    );
    await page.getByRole("button", { name: "Done" }).click();

    expect((await progress).postData()).toContain(`g-${lesson.supabaseId}`);
    await expect(page).toHaveURL(/\/app\/vocabulary\/lessons$/);
  });

  test("hearting a word saves it to favorites", async ({ page }) => {
    await page.goto(lessonUrl);
    await expect(page.getByText("1 of 2")).toBeVisible();

    const save = page.waitForRequest(
      (req) => req.url().includes("/rest/v1/favorite_words") && req.method() === "POST"
    );
    await page.getByRole("button", { name: "Add to favorites" }).click();

    expect((await save).postDataJSON()).toMatchObject({ word_id: lesson.vocabularyWords[0].id });
    await expect(page.getByRole("button", { name: "Remove from favorites" })).toBeVisible();
  });
});

test.describe("generate words", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("rejects a topic that is too short", async ({ page }) => {
    await page.goto("/app/vocabulary/generate");

    await page.getByRole("textbox", { name: "Topic" }).fill("ab");
    await expect(
      page.getByText("Enter 3-50 characters using letters, numbers, spaces, and basic punctuation.")
    ).toBeVisible();
    await expect(page.getByRole("button", { name: /Generate 12 words/ })).toBeDisabled();
  });

  test("a 403 from the AI opens the Pro dialog", async ({ page, api }) => {
    await api.fail("**/api/ai/vocabulary", 403);
    await page.goto("/app/vocabulary/generate");

    await page.getByRole("textbox", { name: "Topic" }).fill("cooking a dinner party");
    await page.getByRole("button", { name: /Generate 12 words/ }).click();

    await expect(
      page.getByRole("heading", { name: "You've used your free word generations" })
    ).toBeVisible();
  });

  test("success navigates to the new generated lesson", async ({ page, api }) => {
    const lesson = lessonFixture();
    await api.json("**/api/ai/vocabulary", { lesson, reused: false });
    await api.table("generated_lessons", [{ id: lesson.supabaseId, lesson_data: lesson }]);

    await page.goto("/app/vocabulary/generate");
    await page.getByRole("textbox", { name: "Topic" }).fill("cooking a dinner party");
    await page.getByRole("button", { name: /Generate 12 words/ }).click();

    await expect(page).toHaveURL(new RegExp(`/app/vocabulary/lessons/g-${lesson.supabaseId}$`));
    await expect(page.getByText("1 of 2")).toBeVisible();
  });
});

test.describe("favorites", () => {
  test.beforeEach(async ({ context }) => {
    await signIn(context);
  });

  test("shows the empty state when there are no favorites", async ({ page }) => {
    await page.goto("/app/vocabulary/favorites");

    await expect(page.getByText("No favorite words yet")).toBeVisible();
  });

  test("offers Practice and Review modes once there are favorites", async ({ page, api }) => {
    const word = lessonFixture().vocabularyWords[0];
    await api.table("favorite_words", [{ word_id: word.id, word_data: word }]);

    await page.goto("/app/vocabulary/favorites");

    await expect(page.getByRole("button", { name: "Practice" })).toBeVisible();
    await expect(page.getByRole("button", { name: "Review" })).toBeVisible();
  });

  test("Review mode walks through every favorite to a completion state", async ({ page, api }) => {
    const [first, second] = lessonFixture().vocabularyWords;
    await api.table("favorite_words", [
      { word_id: first.id, word_data: first },
      { word_id: second.id, word_data: second },
    ]);
    await page.goto("/app/vocabulary/favorites");

    await page.getByRole("button", { name: "Review" }).click();
    await expect(page.getByRole("button", { name: "Review" })).toHaveAttribute("aria-pressed", "true");

    const card = page.getByRole("button", { name: `${first.word}. Tap to see definition.` });
    await card.click();
    await expect(page.getByText(first.definition, { exact: true })).toBeVisible();

    await page.getByRole("button", { name: "I know this" }).click();
    await expect(page.getByRole("button", { name: `${second.word}. Tap to see definition.` })).toBeVisible();
    await page.getByRole("button", { name: "Need practice" }).click();

    await expect(page.getByText("Review complete")).toBeVisible();
    await expect(page.getByText("You've been through all 2 words.")).toBeVisible();
  });
});
