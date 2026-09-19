"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useProfile } from "@/lib/queries/profile";
import { currentPlanDay, weeksOf } from "@/lib/study-plan";
import { STUDY_PLAN_30 } from "@/lib/data/studyPlan";
import { getLessonForPlanTopic } from "@/lib/data/predefinedLessons";
import { DEFAULT_TUTOR_ID, isTutorId } from "@/lib/tutors";
import { isLanguageId } from "@/lib/languages";

/**
 * Full 30-day plan. Ported from fina `app/study-plan.tsx`: a 30-segment
 * progress strip, then each week's days with a status circle, TODAY badge,
 * and Speak / vocab-topic buttons deep-linking into conversation and
 * flashcards respectively.
 *
 * `currentDay` depends on the visitor's local clock, so — like the home
 * greeting — it's only computed after mount (never during the
 * server-rendered pass) to avoid a server/client clock or timezone
 * mismatch. Until then, no day is highlighted as "today".
 */
export default function StudyPlanPage() {
  const { data: profile } = useProfile();
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    async function setMountedNow() {
      setNow(new Date());
    }
    setMountedNow();
  }, []);

  const currentDay = now ? currentPlanDay(profile?.studyPlan.startDate ?? null, now) : null;
  const completed = new Set(profile?.studyPlan.completedDays ?? []);
  const targetLanguage = isLanguageId(profile?.targetLanguage) ? profile!.targetLanguage : "english";
  const tutorId = isTutorId(profile?.tutorId) ? profile!.tutorId : DEFAULT_TUTOR_ID;
  const weeks = weeksOf(STUDY_PLAN_30);

  return (
    <div className="mx-auto max-w-[1080px]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">A steady rhythm</p>
      <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">Your 30-Day Plan</h1>
      {currentDay !== null ? (
        <p className="mt-1 text-sm text-sub">Day {currentDay} of 30</p>
      ) : (
        <div className="mt-2 h-4 w-24 rounded bg-line motion-safe:animate-pulse" aria-hidden />
      )}

      <div className="mt-6 flex gap-[3px]" role="img" aria-label={`${completed.size} of 30 days complete`}>
        {STUDY_PLAN_30.map((d) => {
          const bg = completed.has(d.day) ? "bg-accent-brand" : d.day === currentDay ? "bg-ink" : "bg-line";
          return <span key={d.day} aria-hidden className={`h-[3px] flex-1 rounded-full ${bg}`} />;
        })}
      </div>

      <div className="mt-8 grid gap-8 xl:grid-cols-2">
        {weeks.map((week, weekIdx) => (
          <section key={weekIdx} aria-labelledby={`week-${weekIdx + 1}-heading`}>
            <h2 id={`week-${weekIdx + 1}-heading`} className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sub">
              Week {weekIdx + 1}
            </h2>
            <div className="mt-3 divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
              {week.map((d) => {
                const isDone = completed.has(d.day);
                const isToday = d.day === currentDay;
                const isFuture = currentDay !== null && d.day > currentDay;
                const lesson = getLessonForPlanTopic(d.vocabTopic, targetLanguage);

                return (
                  <div key={d.day} className={`flex flex-col gap-2 px-4 py-3.5 sm:px-5 ${isToday ? "bg-accent-soft" : ""}`}>
                    <div className="flex items-center gap-3">
                      <span
                        aria-hidden
                        className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                          isDone ? "bg-accent-brand text-white" : isToday ? "bg-ink text-white" : "bg-cream text-sub"
                        }`}
                      >
                        {isDone ? "✓" : d.day}
                      </span>
                      <p className={`flex-1 text-[15px] font-semibold ${isFuture ? "text-sub" : "text-ink"}`}>{d.speakLabel}</p>
                      {isToday && (
                        <span className="rounded-md bg-accent-brand px-2 py-0.5 text-[10px] font-bold text-white">TODAY</span>
                      )}
                    </div>
                    <div className="ml-10 flex flex-wrap gap-2">
                      <Link
                        href={`/app/conversation?roleplay=${d.roleplayId}&tutor=${tutorId}`}
                        aria-label={`Practice speaking: ${d.speakLabel}`}
                        className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand ${
                          isToday ? "bg-accent-brand text-white" : "bg-accent-soft text-accent-brand"
                        }`}
                      >
                        Speak
                      </Link>
                      <Link
                        href={lesson ? `/app/vocabulary/lessons/${lesson.id}` : "/app/vocabulary/lessons"}
                        aria-label={`Learn vocabulary: ${d.vocabTopic}`}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-hot/10 px-3 py-1.5 text-xs font-semibold text-hot transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                      >
                        {d.vocabTopic}
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  );
}
