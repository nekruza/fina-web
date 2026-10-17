"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Mic, BookOpen } from "lucide-react";
import { markStudyPlanDayComplete } from "@/lib/db/profile";
import { QUERY_KEYS } from "@/lib/queries/keys";
import { currentPlanDay, displayDay as computeDisplayDay } from "@/lib/study-plan";
import { getSectionDone, markSectionDone } from "@/lib/study-plan-storage";
import { STUDY_PLAN_30, VOCAB_TOPIC_LESSON_IDS } from "@/lib/data/studyPlan";
import type { TutorId } from "@/lib/tutors";

export interface StudyPlanCardProps {
  userId: string;
  tutorId: TutorId;
  studyPlanStartDate: string | null;
  /** Days for which BOTH sections are complete, from the server (`profile.studyPlan.completedDays`). */
  completedDays: number[];
}

/**
 * Home-dashboard study-plan card. Ported from fina `components/StudyPlanCard.tsx`:
 * shows today's speak + vocab actions, marks each section done in
 * localStorage on click, and — once both sections of a day are done —
 * persists the day as complete on the server and advances the displayed
 * day. Footer mirrors the mobile week-progress strip and "View all" link.
 */
export function StudyPlanCard({ userId, tutorId, studyPlanStartDate, completedDays }: StudyPlanCardProps) {
  const queryClient = useQueryClient();
  const [speakDone, setSpeakDone] = useState<Set<number>>(new Set());
  const [vocabDone, setVocabDone] = useState<Set<number>>(new Set());

  useEffect(() => {
    async function loadSectionProgress() {
      setSpeakDone(getSectionDone("speak"));
      setVocabDone(getSectionDone("vocab"));
    }
    loadSectionProgress();
  }, []);

  const completed = new Set(completedDays);
  const currentDay = currentPlanDay(studyPlanStartDate);
  const displayDayNumber = computeDisplayDay(currentDay, speakDone, vocabDone);
  const today = STUDY_PLAN_30[displayDayNumber - 1];

  if (!today) return null;

  const speakForDay = speakDone.has(displayDayNumber);
  const vocabForDay = vocabDone.has(displayDayNumber);
  const bothDone = speakForDay && vocabForDay;
  const lessonId = VOCAB_TOPIC_LESSON_IDS[today.vocabTopic];

  function completeDayIfBothDone(day: number, speak: Set<number>, vocab: Set<number>) {
    if (speak.has(day) && vocab.has(day)) {
      // supabase-js is loaded on demand to keep it out of the home page's first-load JS.
      import("@/lib/supabase/client")
        .then(({ createClient }) => markStudyPlanDayComplete(createClient(), userId, day))
        .then(() => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile }))
        .catch((error) => {
          // The local speak/vocab ticks stay set either way, so the next
          // both-done interaction on this day will retry the server write —
          // don't touch that state here, just surface the failure.
          console.error("Failed to save study plan progress", error);
          toast.error("Couldn't save today's plan progress. It'll retry next time.");
        });
    }
  }

  function handleSpeakClick() {
    const next = markSectionDone("speak", displayDayNumber);
    setSpeakDone(next);
    completeDayIfBothDone(displayDayNumber, next, vocabDone);
  }

  function handleVocabClick() {
    const next = markSectionDone("vocab", displayDayNumber);
    setVocabDone(next);
    completeDayIfBothDone(displayDayNumber, speakDone, next);
  }

  const week = Math.ceil(displayDayNumber / 7);
  const weekStart = (week - 1) * 7;

  return (
    <section className="overflow-hidden rounded-[1.75rem] border border-line bg-surface" aria-labelledby="study-plan-heading">
      <div className="px-5 pt-5 pb-3 sm:px-7">
        <div className="flex items-center justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">
            {bothDone ? "Completed" : "Today’s Plan"}
          </p>
          <p className="text-xs font-semibold text-sub">
            Day {displayDayNumber} of 30 · {completed.size} done
          </p>
        </div>
        <h2 id="study-plan-heading" className="mt-1 font-display text-xl text-ink">
          {today.speakLabel}
        </h2>
      </div>

      <div className="flex flex-col gap-2 px-5 pb-4 sm:px-7">
        <Link
          href={`/app/conversation?roleplay=${today.roleplayId}&tutor=${tutorId}`}
          onClick={handleSpeakClick}
          aria-label={`Practice speaking: ${today.speakLabel}`}
          className="flex items-center gap-3 rounded-2xl bg-accent-soft px-4 py-3 transition hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-accent-brand">
            <Mic className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{today.speakLabel}</span>
            <span className="block text-xs text-sub">Voice chat with your AI tutor</span>
          </span>
          {speakForDay ? (
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white"
            >
              ✓
            </span>
          ) : (
            <span className="shrink-0 text-sub" aria-hidden>
              ›
            </span>
          )}
        </Link>

        <Link
          href={lessonId ? `/app/vocabulary/lessons/${lessonId}` : "/app/vocabulary/lessons"}
          onClick={handleVocabClick}
          aria-label={`Learn vocabulary: ${today.vocabTopic}`}
          className="flex items-center gap-3 rounded-2xl bg-hot/10 px-4 py-3 transition hover:brightness-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
        >
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-surface text-hot">
            <BookOpen className="h-4 w-4" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">{today.vocabTopic}</span>
            <span className="block text-xs text-sub">Learn the words</span>
          </span>
          {vocabForDay ? (
            <span
              aria-hidden
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-brand text-xs font-bold text-white"
            >
              ✓
            </span>
          ) : (
            <span className="shrink-0 text-sub" aria-hidden>
              ›
            </span>
          )}
        </Link>
      </div>

      <div className="px-5 pb-5 sm:px-7">
        <div className="mb-2 flex items-center justify-between">
          <p className="text-[11px] font-semibold text-sub">Week {week} of 5</p>
          <Link
            href="/app/study-plan"
            className="rounded text-xs font-semibold text-accent-brand hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
          >
            View all
          </Link>
        </div>
        <div className="flex gap-1" role="img" aria-label={`Week ${week} progress`}>
          {Array.from({ length: 7 }).map((_, i) => {
            const dayNum = weekStart + i + 1;
            const bg =
              dayNum > 30
                ? "bg-line"
                : completed.has(dayNum)
                  ? "bg-accent-brand"
                  : dayNum === currentDay
                    ? "bg-ink"
                    : "bg-line";
            return <span key={i} aria-hidden className={`h-[3px] flex-1 rounded-full ${bg}`} />;
          })}
        </div>
      </div>
    </section>
  );
}
