"use client";

import Link from "next/link";
import { Check, Trash2 } from "lucide-react";
import type { Lesson } from "@/lib/types/vocabulary";
import type { LanguageId } from "@/lib/languages";
import { LanguageFlag } from "./LanguageFlag";

export interface LessonCardProps {
  lesson: Lesson;
  href: string;
  completed: boolean;
  /** Language the lesson is in; omitted when unknown, in which case no flag is shown. */
  language?: LanguageId;
  /** Only generated lessons can be deleted. */
  onDelete?: () => void;
}

/** A single lesson tile in the lessons grid — predefined topic or AI-generated. */
export function LessonCard({ lesson, href, completed, language, onDelete }: LessonCardProps) {
  return (
    <div className="relative">
      <Link
        href={href}
        className="flex min-h-[200px] flex-col items-center rounded-3xl border border-line bg-surface p-5 text-center transition hover:border-sub/40 hover:shadow-[0_16px_32px_-24px_rgba(27,26,23,0.18)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
      >
        <div className="mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-accent-soft text-2xl">
          <span aria-hidden>{lesson.emoji}</span>
        </div>

        <p className="font-display text-base leading-snug text-ink">{lesson.title}</p>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-sub">{lesson.description}</p>

        <p className="mt-auto pt-3 text-xs font-medium text-sub">
          {lesson.wordsCount} words · {lesson.duration} · {lesson.difficulty}
        </p>
      </Link>

      <div className="pointer-events-none absolute top-2 left-2 right-2 flex items-start justify-between">
        <div className="flex items-center gap-1.5">
          {lesson.isUserGenerated && (
            <span className="rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-cream">
              AI
            </span>
          )}
          {language && <LanguageFlag language={language} className="text-base" />}
        </div>
        {completed && (
          <span className="ml-auto flex items-center gap-1 rounded-full bg-accent-soft px-2 py-0.5 text-[10px] font-semibold text-accent-brand">
            <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
            Completed
          </span>
        )}
      </div>

      {onDelete && (
        <button
          type="button"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDelete();
          }}
          aria-label={`Delete ${lesson.title}`}
          className="pointer-events-auto absolute bottom-2 right-2 flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-sub transition hover:text-hot focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <Trash2 className="h-3.5 w-3.5" aria-hidden />
        </button>
      )}
    </div>
  );
}
