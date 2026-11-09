/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { LessonCard } from "../LessonCard";
import type { Lesson } from "@/lib/types/vocabulary";

const LESSON: Lesson = {
  id: "abc",
  title: "London",
  description: "AI-generated vocabulary words about London",
  wordsCount: 12,
  duration: "10 min",
  difficulty: "Beginner",
  completed: false,
  emoji: "🤖",
  vocabularyWords: [],
  isUserGenerated: true,
};

function renderCard(props: Partial<React.ComponentProps<typeof LessonCard>> = {}) {
  return render(<LessonCard lesson={LESSON} href="/lesson/abc" completed={false} {...props} />);
}

describe("LessonCard language flag", () => {
  it("shows only the flag for the lesson's language", () => {
    renderCard({ language: "english_uk" });
    const flag = screen.getByRole("img", { name: "English (UK)" });
    expect(flag).toHaveTextContent("🇬🇧");
    expect(flag).not.toHaveTextContent("English");
  });

  it("shows the flag next to the AI badge", () => {
    renderCard({ language: "spanish" });
    expect(screen.getByText("AI")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Spanish" })).toHaveTextContent("🇪🇸");
  });

  it("shows no flag when the language is unknown", () => {
    renderCard();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
