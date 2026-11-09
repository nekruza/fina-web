/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { FlashcardDeck } from "../FlashcardDeck";
import type { Lesson } from "@/lib/types/vocabulary";

jest.mock("@/lib/hooks/usePronunciation", () => ({
  usePronunciation: () => ({ play: jest.fn(), loadingKey: null, playingKey: null, error: null }),
}));

jest.mock("../Flashcard", () => ({
  Flashcard: ({ word, language }: { word: { word: string }; language?: string }) => (
    <div data-testid="flashcard-face" data-language={language}>
      {word.word}
    </div>
  ),
}));

const LESSON: Lesson = {
  id: 1,
  title: "Greetings",
  description: "Basics",
  wordsCount: 3,
  duration: "3 min",
  difficulty: "Beginner",
  completed: false,
  emoji: "👋",
  vocabularyWords: [
    { id: "w1", title_id: 1, word: "Hello", definition: "A greeting", example: "Hello there.", difficulty: "easy", category: "greetings", audioURL: "" },
    { id: "w2", title_id: 1, word: "Goodbye", definition: "A farewell", example: "Goodbye now.", difficulty: "easy", category: "greetings", audioURL: "" },
    { id: "w3", title_id: 1, word: "Please", definition: "Politeness", example: "Please help.", difficulty: "easy", category: "greetings", audioURL: "" },
  ],
};

function renderDeck(overrides: Partial<React.ComponentProps<typeof FlashcardDeck>> = {}) {
  const props = {
    lesson: LESSON,
    language: "english" as const,
    favoriteIds: new Set<string>(),
    onToggleFavorite: jest.fn(),
    onClose: jest.fn(),
    onComplete: jest.fn(),
    ...overrides,
  };
  return { ...render(<FlashcardDeck {...props} />), props };
}

describe("card language", () => {
  it("uses the language the lesson was generated in, not the profile's", () => {
    renderDeck({ lesson: { ...LESSON, language: "spanish" }, language: "english" });
    expect(screen.getByTestId("flashcard-face")).toHaveAttribute("data-language", "spanish");
  });

  it("falls back to the learner's language for lessons without one", () => {
    renderDeck({ language: "english_uk" });
    expect(screen.getByTestId("flashcard-face")).toHaveAttribute("data-language", "english_uk");
  });
});

describe("navigation", () => {
  it("shows the first word and 1 of n on mount", () => {
    renderDeck();
    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("advances to the next word on Next", () => {
    renderDeck();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Goodbye")).toBeInTheDocument();
    expect(screen.getByText("2 of 3")).toBeInTheDocument();
  });

  it("goes back to the previous word on Previous", () => {
    renderDeck();

    fireEvent.click(screen.getByRole("button", { name: /next/i }));
    fireEvent.click(screen.getByRole("button", { name: /previous/i }));

    expect(screen.getByText("Hello")).toBeInTheDocument();
    expect(screen.getByText("1 of 3")).toBeInTheDocument();
  });

  it("disables Previous on the first word", () => {
    renderDeck();
    expect(screen.getByRole("button", { name: /previous/i })).toBeDisabled();
  });

  it("calls onIndexChange when the index changes", () => {
    const onIndexChange = jest.fn();
    renderDeck({ onIndexChange });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(onIndexChange).toHaveBeenCalledWith(1);
  });

  it("resumes from initialIndex", () => {
    renderDeck({ initialIndex: 2 });
    expect(screen.getByText("Please")).toBeInTheDocument();
    expect(screen.getByText("3 of 3")).toBeInTheDocument();
  });
});

describe("keyboard navigation", () => {
  it("moves to the next word on ArrowRight", async () => {
    renderDeck();

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
    });

    await waitFor(() => expect(screen.getByText("Goodbye")).toBeInTheDocument());
  });

  it("moves to the previous word on ArrowLeft", async () => {
    renderDeck({ initialIndex: 1 });

    act(() => {
      window.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
    });

    await waitFor(() => expect(screen.getByText("Hello")).toBeInTheDocument());
  });
});

describe("header controls", () => {
  it("calls onClose from the close button", () => {
    const onClose = jest.fn();
    renderDeck({ onClose });

    fireEvent.click(screen.getByRole("button", { name: "Close lesson" }));

    expect(onClose).toHaveBeenCalled();
  });

  it("restarts to the first word from the restart button", () => {
    renderDeck({ initialIndex: 2 });

    fireEvent.click(screen.getByRole("button", { name: /restart/i }));

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });
});

describe("completion", () => {
  it("shows the completion screen after Next past the last word", () => {
    renderDeck({ initialIndex: 2 });

    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    expect(screen.getByText("Lesson complete! 🎉")).toBeInTheDocument();
    expect(screen.getByText("You've learned 3 new words in Greetings")).toBeInTheDocument();
  });

  it("Review again returns to the first word", () => {
    renderDeck({ initialIndex: 2 });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    fireEvent.click(screen.getByRole("button", { name: "Review again" }));

    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("Done calls onComplete", () => {
    const onComplete = jest.fn();
    renderDeck({ initialIndex: 2, onComplete });
    fireEvent.click(screen.getByRole("button", { name: /next/i }));

    fireEvent.click(screen.getByRole("button", { name: "Done" }));

    expect(onComplete).toHaveBeenCalled();
  });
});
