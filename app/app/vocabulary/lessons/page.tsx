"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Sparkles } from "lucide-react";
import { useProfile } from "@/lib/queries/profile";
import { useCompletedLessons, useDeleteGeneratedLesson, useGeneratedLessons } from "@/lib/queries/vocabulary";
import { getPredefinedLessons, searchPredefinedLessons } from "@/lib/data/predefinedLessons";
import { isLanguageId } from "@/lib/languages";
import { LessonCard } from "@/components/vocabulary/LessonCard";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { Lesson } from "@/lib/types/vocabulary";
import Link from "next/link";

function useDebouncedValue<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(id);
  }, [value, delayMs]);
  return debounced;
}

export default function LessonsPage() {
  const { data: profile } = useProfile();
  const targetLanguage = isLanguageId(profile?.targetLanguage) ? profile!.targetLanguage : "english";

  const [searchQuery, setSearchQuery] = useState("");
  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const isSearching = debouncedQuery.trim().length >= 2;

  const { data: completedLessons } = useCompletedLessons();
  const { data: generatedData } = useGeneratedLessons(debouncedQuery);
  const deleteLesson = useDeleteGeneratedLesson();

  const predefinedLessons = useMemo(
    () => (isSearching ? searchPredefinedLessons(debouncedQuery, targetLanguage) : getPredefinedLessons(targetLanguage)),
    [isSearching, debouncedQuery, targetLanguage]
  );

  const generatedLessons = generatedData?.lessons ?? [];
  const lessons: Lesson[] = [...generatedLessons, ...predefinedLessons];

  const [pendingDelete, setPendingDelete] = useState<Lesson | null>(null);

  function isCompleted(lesson: Lesson): boolean {
    const key = lesson.isUserGenerated ? `g-${lesson.supabaseId}` : String(lesson.id);
    return completedLessons?.has(key) ?? false;
  }

  function hrefFor(lesson: Lesson): string {
    return lesson.isUserGenerated ? `/app/vocabulary/lessons/g-${lesson.supabaseId}` : `/app/vocabulary/lessons/${lesson.id}`;
  }

  function confirmDelete() {
    if (!pendingDelete?.supabaseId) return;
    deleteLesson.mutate(pendingDelete.supabaseId);
    setPendingDelete(null);
  }

  return (
    <div className="mx-auto max-w-5xl">
      <h1 className="font-display text-3xl text-ink">Topics</h1>
      <p className="mt-1.5 text-base text-sub">Master vocabulary through interactive lessons</p>

      <div className="relative mt-6 max-w-md">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-sub" aria-hidden />
        <input
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search topics…"
          aria-label="Search topics"
          className="w-full rounded-2xl border border-line bg-surface py-3 pl-11 pr-4 text-[15px] text-ink placeholder:text-sub focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        />
      </div>

      {lessons.length > 0 ? (
        <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3">
          {lessons.map((lesson) => (
            <LessonCard
              key={lesson.isUserGenerated ? `g-${lesson.supabaseId}` : lesson.id}
              lesson={lesson}
              href={hrefFor(lesson)}
              completed={isCompleted(lesson)}
              // Predefined lessons are always in the learner's language; older generated ones never recorded theirs.
              language={lesson.language ?? (lesson.isUserGenerated ? undefined : targetLanguage)}
              onDelete={lesson.isUserGenerated ? () => setPendingDelete(lesson) : undefined}
            />
          ))}
        </div>
      ) : isSearching ? (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="font-display text-2xl text-ink">Topic not found</p>
          <p className="mt-2 max-w-sm text-sm text-sub">
            This topic doesn&apos;t exist yet, but you can create it using AI.
          </p>
          <Link
            href="/app/vocabulary/generate"
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-ink px-6 py-3 text-[15px] font-semibold text-cream transition hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            <Sparkles className="h-4 w-4" aria-hidden />
            Generate Words
          </Link>
        </div>
      ) : (
        <div className="mt-16 flex flex-col items-center text-center">
          <p className="font-display text-2xl text-ink">No lessons yet</p>
          <p className="mt-2 max-w-sm text-sm text-sub">Check back soon, or generate your own vocabulary lesson.</p>
        </div>
      )}

      <Dialog open={!!pendingDelete} onOpenChange={(open) => !open && setPendingDelete(null)}>
        <DialogContent className="border-line bg-surface text-ink sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="font-display text-xl font-normal text-ink">Delete lesson?</DialogTitle>
            <DialogDescription className="text-sm text-sub">
              This will permanently remove &ldquo;{pendingDelete?.title}&rdquo;.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:justify-end">
            <button
              type="button"
              onClick={() => setPendingDelete(null)}
              className="rounded-full border border-line px-5 py-2.5 text-sm font-semibold text-ink transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={confirmDelete}
              className="rounded-full bg-hot px-5 py-2.5 text-sm font-semibold text-cream transition hover:bg-hot/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              Delete
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
