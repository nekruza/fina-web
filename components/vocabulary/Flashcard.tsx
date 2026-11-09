"use client";

import { Heart, Volume2 } from "lucide-react";
import type { VocabularyWord } from "@/lib/types/vocabulary";
import type { LanguageId } from "@/lib/languages";
import { LanguageFlag } from "./LanguageFlag";

export type PlayState = "idle" | "loading" | "playing";

export interface FlashcardProps {
  word: VocabularyWord;
  /** Language the word is in; shown as a flag beside the difficulty. */
  language?: LanguageId;
  isFavorite: boolean;
  onToggleFavorite: () => void;
  playState: PlayState;
  onPlay: () => void;
}

const DIFFICULTY_STYLES: Record<VocabularyWord["difficulty"], string> = {
  easy: "bg-accent-soft text-accent-brand",
  medium: "bg-hot/10 text-hot",
  hard: "bg-ink text-cream",
};

const PLAY_LABEL: Record<PlayState, string> = {
  idle: "Play pronunciation",
  loading: "Loading…",
  playing: "Playing…",
};

/** A single vocabulary flashcard face: word, pronunciation, definition, example. */
export function Flashcard({ word, language, isFavorite, onToggleFavorite, playState, onPlay }: FlashcardProps) {
  return (
    <div className="w-full max-w-sm rounded-[2rem] border border-line bg-surface p-8 shadow-[0_24px_48px_-24px_rgba(27,26,23,0.18)]">
      <div className="mb-6 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${DIFFICULTY_STYLES[word.difficulty]}`}
          >
            {word.difficulty}
          </span>
          {language && <LanguageFlag language={language} className="text-xl" />}
        </div>
        <button
          type="button"
          onClick={onToggleFavorite}
          aria-label={isFavorite ? "Remove from favorites" : "Add to favorites"}
          aria-pressed={isFavorite}
          className="flex h-9 w-9 items-center justify-center rounded-full border border-line bg-cream text-sub transition hover:text-hot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <Heart className="h-4 w-4" fill={isFavorite ? "currentColor" : "none"} color={isFavorite ? "#D94F2A" : "currentColor"} aria-hidden />
        </button>
      </div>

      <div className="mb-7 text-center">
        <p id={`flashcard-word-${word.id}`} className="font-display text-3xl leading-tight text-ink sm:text-4xl">
          {word.word}
        </p>
        {word.pronunciation && <p className="mt-1.5 text-base text-sub">/{word.pronunciation}/</p>}
        {word.partOfSpeech && <p className="mt-1 text-sm italic text-sub">{word.partOfSpeech}</p>}
      </div>

      <div className="mb-5">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-accent-brand">Definition</p>
        <p className="text-[15px] leading-relaxed text-ink">{word.definition}</p>
      </div>

      <div className="mb-7">
        <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.14em] text-sub">Example</p>
        <p className="text-[15px] italic leading-relaxed text-sub">{word.example}</p>
      </div>

      <button
        type="button"
        onClick={onPlay}
        disabled={playState !== "idle"}
        aria-describedby={`flashcard-word-${word.id}`}
        className="flex w-full items-center justify-center gap-2 rounded-2xl bg-ink px-5 py-3.5 text-[15px] font-semibold text-cream transition hover:bg-ink/90 disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
      >
        <Volume2 className="h-4 w-4" aria-hidden />
        {PLAY_LABEL[playState]}
      </button>
    </div>
  );
}
