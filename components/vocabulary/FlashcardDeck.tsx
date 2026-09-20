"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight, RotateCcw, X } from "lucide-react";
import { usePronunciation } from "@/lib/hooks/usePronunciation";
import type { LanguageId } from "@/lib/languages";
import type { Lesson, VocabularyWord } from "@/lib/types/vocabulary";
import { Flashcard } from "./Flashcard";

export interface FlashcardDeckProps {
  lesson: Lesson;
  language: LanguageId;
  /** Word index to resume from (clamped to the word list). */
  initialIndex?: number;
  favoriteIds: Set<string>;
  onToggleFavorite: (word: VocabularyWord, favorite: boolean) => void;
  /** Called with the current word index whenever it changes (not called for the completion screen). */
  onIndexChange?: (index: number) => void;
  onClose: () => void;
  /** Called when the learner finishes the deck from the completion screen ("Done"). */
  onComplete: () => void;
}

const SWIPE_THRESHOLD = 50;

export function FlashcardDeck({
  lesson,
  language,
  initialIndex = 0,
  favoriteIds,
  onToggleFavorite,
  onIndexChange,
  onClose,
  onComplete,
}: FlashcardDeckProps) {
  const words = lesson.vocabularyWords;
  const total = words.length;
  const clampedInitial = Math.min(Math.max(initialIndex, 0), Math.max(total - 1, 0));
  const [currentIndex, setCurrentIndex] = useState(clampedInitial);

  const { play, loadingKey, playingKey } = usePronunciation(language);

  const isComplete = currentIndex >= total;
  const currentWord = !isComplete ? words[currentIndex] : undefined;

  const goTo = useCallback(
    (index: number) => {
      const next = Math.min(Math.max(index, 0), total);
      setCurrentIndex(next);
      if (next < total) onIndexChange?.(next);
    },
    [total, onIndexChange]
  );

  const goNext = useCallback(() => goTo(currentIndex + 1), [goTo, currentIndex]);
  const goPrev = useCallback(() => goTo(currentIndex - 1), [goTo, currentIndex]);
  const restart = useCallback(() => goTo(0), [goTo]);

  useEffect(() => {
    function handleKeydown(e: KeyboardEvent) {
      if (e.key === "ArrowRight") goNext();
      else if (e.key === "ArrowLeft") goPrev();
    }
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [goNext, goPrev]);

  const touchStartX = useRef<number | null>(null);
  const touchStartY = useRef<number | null>(null);

  function handleTouchStart(e: React.TouchEvent) {
    touchStartX.current = e.touches[0].clientX;
    touchStartY.current = e.touches[0].clientY;
  }

  function handleTouchEnd(e: React.TouchEvent) {
    if (touchStartX.current == null || touchStartY.current == null) return;
    const dx = e.changedTouches[0].clientX - touchStartX.current;
    const dy = e.changedTouches[0].clientY - touchStartY.current;
    touchStartX.current = null;
    touchStartY.current = null;
    if (Math.abs(dx) < SWIPE_THRESHOLD || Math.abs(dx) < Math.abs(dy)) return;
    if (dx < 0) goNext();
    else goPrev();
  }

  return (
    <div className="flex min-h-[calc(100vh-2rem)] flex-col">
      <div className="mb-8 flex items-center justify-between">
        <button
          type="button"
          onClick={onClose}
          aria-label="Close lesson"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <X className="h-4 w-4" aria-hidden />
        </button>

        <div className="text-center">
          <p className="font-display text-lg text-ink">{lesson.title}</p>
          {!isComplete && (
            <p className="mt-0.5 text-xs font-semibold uppercase tracking-wide text-sub">
              {currentIndex + 1} of {total}
            </p>
          )}
        </div>

        <button
          type="button"
          onClick={restart}
          aria-label="Restart from beginning"
          className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <RotateCcw className="h-4 w-4" aria-hidden />
        </button>
      </div>

      {isComplete ? (
        <div className="flex flex-1 items-center justify-center px-4">
          <div className="w-full max-w-sm rounded-[2rem] border border-line bg-surface p-8 text-center shadow-[0_24px_48px_-24px_rgba(27,26,23,0.18)]">
            <h2 className="font-display text-2xl text-ink">Lesson complete! 🎉</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-sub">
              You&apos;ve learned {total} new words in {lesson.title}
            </p>
            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={restart}
                className="flex-1 rounded-2xl border border-line bg-cream px-4 py-3 text-[15px] font-semibold text-ink transition hover:bg-line focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                Review again
              </button>
              <button
                type="button"
                onClick={onComplete}
                className="flex-1 rounded-2xl bg-accent-brand px-4 py-3 text-[15px] font-semibold text-cream transition hover:bg-accent-brand/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
              >
                Done
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-6 px-4">
          <div
            className="relative isolate flex w-full justify-center"
            onTouchStart={handleTouchStart}
            onTouchEnd={handleTouchEnd}
          >
            {/* Keep the decorative card behind the face within this isolated stack. */}
            {currentIndex + 1 < total && (
              <div
                aria-hidden
                className="pointer-events-none absolute inset-0 -z-10 mx-auto hidden w-full max-w-sm translate-y-2 rotate-1 rounded-[2rem] border border-line bg-surface opacity-70 motion-safe:sm:block"
              />
            )}
            {currentWord && (
              <Flashcard
                word={currentWord}
                isFavorite={favoriteIds.has(currentWord.id)}
                onToggleFavorite={() => onToggleFavorite(currentWord, !favoriteIds.has(currentWord.id))}
                playState={loadingKey === currentWord.id ? "loading" : playingKey === currentWord.id ? "playing" : "idle"}
                onPlay={() => play(currentWord.word, currentWord.id)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={goPrev}
              disabled={currentIndex === 0}
              aria-label="Previous word"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-cream disabled:opacity-40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <button
              type="button"
              onClick={goNext}
              aria-label="Next word"
              className="flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-ink transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
