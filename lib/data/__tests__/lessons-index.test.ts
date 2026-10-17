import { getLessonsForLanguage, lessonsByLanguage, searchLessonsForLanguage } from "@/lib/data/lessons";

describe("getLessonsForLanguage", () => {
  it("returns the lessons for a known language", () => {
    expect(getLessonsForLanguage("spanish")).toBe(lessonsByLanguage.spanish);
  });

  it("defaults to English when no language is given", () => {
    expect(getLessonsForLanguage()).toBe(lessonsByLanguage.english);
  });

  it("falls back to English for an unknown language", () => {
    expect(getLessonsForLanguage("klingon")).toBe(lessonsByLanguage.english);
  });
});

describe("searchLessonsForLanguage", () => {
  const english = lessonsByLanguage.english;

  it("returns every lesson for a blank query", () => {
    expect(searchLessonsForLanguage("   ")).toBe(english);
  });

  it("matches on title, case-insensitively", () => {
    const { title } = english[0];
    const results = searchLessonsForLanguage(title.toUpperCase(), "english");
    expect(results).toContain(english[0]);
  });

  it("matches on description", () => {
    const lesson = english.find((l) => l.description.length > 0)!;
    const results = searchLessonsForLanguage(lesson.description, "english");
    expect(results).toContain(lesson);
  });

  it("matches on a vocabulary word", () => {
    const lesson = english.find((l) => l.vocabularyWords.length > 0)!;
    const word = lesson.vocabularyWords[0].word;
    expect(searchLessonsForLanguage(word, "english")).toContain(lesson);
  });

  it("returns nothing when no lesson matches", () => {
    expect(searchLessonsForLanguage("zzqqxx-no-such-lesson", "english")).toEqual([]);
  });
});
