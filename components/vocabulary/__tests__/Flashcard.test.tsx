/** @jest-environment jsdom */
import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
import { Flashcard } from "../Flashcard";
import type { VocabularyWord } from "@/lib/types/vocabulary";

const WORD: VocabularyWord = {
  id: "w1",
  title_id: 1,
  word: "color",
  definition: "A way that things look to the eye",
  example: "The rainbow has many colors.",
  difficulty: "easy",
  category: "colors",
  audioURL: "",
};

function renderCard(language?: React.ComponentProps<typeof Flashcard>["language"]) {
  return render(
    <Flashcard word={WORD} language={language} isFavorite={false} onToggleFavorite={jest.fn()} playState="idle" onPlay={jest.fn()} />
  );
}

describe("Flashcard language flag", () => {
  it("shows only the flag beside the difficulty", () => {
    renderCard("english");
    const flag = screen.getByRole("img", { name: "English (US)" });
    expect(flag).toHaveTextContent("🇺🇸");
    expect(flag).not.toHaveTextContent("English");
  });

  it("tells US and UK English apart", () => {
    renderCard("english_uk");
    expect(screen.getByRole("img", { name: "English (UK)" })).toHaveTextContent("🇬🇧");
  });

  it("shows no flag when no language is given", () => {
    renderCard();
    expect(screen.queryByRole("img")).not.toBeInTheDocument();
  });
});
