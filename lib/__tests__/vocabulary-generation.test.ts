import {
  validateTopic,
  buildVocabularyPrompt,
  parseGeneratedWords,
  lessonFromWords,
} from "@/lib/vocabulary-generation";

describe("validateTopic", () => {
  it("accepts a normal topic", () => {
    expect(validateTopic("cooking a dinner party")).toBe(true);
  });

  it("accepts non-latin letters and basic punctuation", () => {
    expect(validateTopic("café & tapas")).toBe(true);
  });

  it("rejects a topic shorter than 3 characters", () => {
    expect(validateTopic("a")).toBe(false);
  });

  it("rejects a topic longer than 50 characters", () => {
    expect(validateTopic("x".repeat(51))).toBe(false);
  });

  it("accepts exactly 50 characters", () => {
    expect(validateTopic("x".repeat(50))).toBe(true);
  });

  it("accepts exactly 3 characters", () => {
    expect(validateTopic("cat")).toBe(true);
  });

  it("rejects disallowed punctuation", () => {
    expect(validateTopic("<script>alert(1)</script>")).toBe(false);
  });

  it("rejects an empty string", () => {
    expect(validateTopic("")).toBe(false);
  });
});

describe("buildVocabularyPrompt", () => {
  it("mentions the requested language, topic, count, and difficulty", () => {
    const prompt = buildVocabularyPrompt({
      topic: "cooking",
      difficulty: "medium",
      count: 12,
      level: "beginner",
      language: "spanish",
    });

    expect(prompt).toContain("12");
    expect(prompt).toContain("Spanish");
    expect(prompt).toContain("cooking");
    expect(prompt).toContain("medium");
  });

  it("instructs the model to reply with JSON only", () => {
    const prompt = buildVocabularyPrompt({
      topic: "travel",
      difficulty: "easy",
      count: 12,
      level: "intermediate",
      language: "english",
    });

    expect(prompt).toContain("JSON array");
    expect(prompt).toContain("word, definition, example, pronunciation");
  });

  it("mentions the user's level", () => {
    const prompt = buildVocabularyPrompt({
      topic: "travel",
      difficulty: "easy",
      count: 12,
      level: "advanced",
      language: "english",
    });

    expect(prompt.toLowerCase()).toContain("advanced");
  });
});

const VALID_ITEM = {
  word: "hola",
  definition: "hello",
  example: "¡Hola! ¿Cómo estás?",
  pronunciation: "ˈo.la",
  partOfSpeech: "interjection",
  difficulty: "easy",
  category: "greetings",
};

describe("parseGeneratedWords", () => {
  it("parses a plain JSON array", () => {
    const words = parseGeneratedWords(JSON.stringify([VALID_ITEM]), "greetings", "easy");
    expect(words).toHaveLength(1);
    expect(words[0]).toMatchObject({
      title_id: 999,
      word: "hola",
      definition: "hello",
      example: "¡Hola! ¿Cómo estás?",
      pronunciation: "ˈo.la",
      partOfSpeech: "interjection",
      difficulty: "easy",
      category: "greetings",
      audioURL: "",
    });
    expect(words[0].id).toMatch(/^generated_\d+_0$/);
  });

  it("parses a {words: [...]} envelope", () => {
    const words = parseGeneratedWords(JSON.stringify({ words: [VALID_ITEM] }), "greetings", "easy");
    expect(words).toHaveLength(1);
    expect(words[0].word).toBe("hola");
  });

  it("strips markdown code fences", () => {
    const fenced = "```json\n" + JSON.stringify([VALID_ITEM]) + "\n```";
    const words = parseGeneratedWords(fenced, "greetings", "easy");
    expect(words).toHaveLength(1);
  });

  it("strips fences without a json language tag", () => {
    const fenced = "```\n" + JSON.stringify([VALID_ITEM]) + "\n```";
    const words = parseGeneratedWords(fenced, "greetings", "easy");
    expect(words).toHaveLength(1);
  });

  it("assigns sequential generated ids", () => {
    const words = parseGeneratedWords(JSON.stringify([VALID_ITEM, VALID_ITEM]), "greetings", "easy");
    expect(words[0].id).toMatch(/_0$/);
    expect(words[1].id).toMatch(/_1$/);
  });

  it("drops items missing required fields", () => {
    const words = parseGeneratedWords(
      JSON.stringify([VALID_ITEM, { word: "onlyWord" }]),
      "greetings",
      "easy"
    );
    expect(words).toHaveLength(1);
  });

  it("falls back to the requested difficulty when the item's difficulty is invalid", () => {
    const words = parseGeneratedWords(
      JSON.stringify([{ ...VALID_ITEM, difficulty: "impossible" }]),
      "greetings",
      "hard"
    );
    expect(words[0].difficulty).toBe("hard");
  });

  it("drops an invalid partOfSpeech rather than the whole item", () => {
    const words = parseGeneratedWords(
      JSON.stringify([{ ...VALID_ITEM, partOfSpeech: "gerund" }]),
      "greetings",
      "easy"
    );
    expect(words).toHaveLength(1);
    expect(words[0].partOfSpeech).toBeUndefined();
  });

  it("defaults category to the requested topic when missing", () => {
    const item = { ...VALID_ITEM } as Record<string, unknown>;
    delete item.category;
    const words = parseGeneratedWords(JSON.stringify([item]), "greetings", "easy");
    expect(words[0].category).toBe("greetings");
  });

  it("defaults pronunciation to an empty string when missing", () => {
    const item = { ...VALID_ITEM } as Record<string, unknown>;
    delete item.pronunciation;
    const words = parseGeneratedWords(JSON.stringify([item]), "greetings", "easy");
    expect(words[0].pronunciation).toBe("");
  });

  it("throws when there are zero valid words", () => {
    expect(() => parseGeneratedWords(JSON.stringify([{ word: "x" }]), "greetings", "easy")).toThrow();
  });

  it("throws when the array is empty", () => {
    expect(() => parseGeneratedWords(JSON.stringify([]), "greetings", "easy")).toThrow();
  });

  it("throws on unparsable JSON", () => {
    expect(() => parseGeneratedWords("not json at all", "greetings", "easy")).toThrow();
  });

  it("throws when the payload is a JSON object without a words array", () => {
    expect(() => parseGeneratedWords(JSON.stringify({ foo: "bar" }), "greetings", "easy")).toThrow();
  });
});

describe("lessonFromWords", () => {
  const words = parseGeneratedWords(JSON.stringify([VALID_ITEM]), "greetings", "easy");

  it("builds a lesson with the topic as title", () => {
    const lesson = lessonFromWords({ id: "abc", topic: "greetings", difficulty: "easy", words });
    expect(lesson.id).toBe("abc");
    expect(lesson.title).toBe("greetings");
    expect(lesson.wordsCount).toBe(1);
    expect(lesson.vocabularyWords).toEqual(words);
    expect(lesson.emoji).toBe("🤖");
    expect(lesson.completed).toBe(false);
  });

  it("records the language the lesson was generated in", () => {
    const lesson = lessonFromWords({ id: "abc", topic: "greetings", difficulty: "easy", words, language: "english_uk" });
    expect(lesson.language).toBe("english_uk");
  });

  it.each([
    ["easy", "Beginner"],
    ["medium", "Intermediate"],
    ["hard", "Advanced"],
  ] as const)("maps difficulty %s to %s", (difficulty, label) => {
    const lesson = lessonFromWords({ id: "abc", topic: "greetings", difficulty, words });
    expect(lesson.difficulty).toBe(label);
  });
});
