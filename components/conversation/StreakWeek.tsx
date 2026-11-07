"use client";

import { Check, Flame } from "lucide-react";

/**
 * Current streak + Monday–Sunday activity squares.
 *
 * `weeklyActivity` is indexed by JS `Date.getDay()` (0 = Sunday), so the
 * Monday-first row reads indices [1,2,3,4,5,6,0]. Motivational copy ported
 * from fina `app/streak.tsx` getMotivationalText.
 */

/** Monday-first day-of-week mapping onto `weeklyActivity`'s `Date.getDay()` (0 = Sunday) indices. Shared with `components/home/StreakCard`. */
export const WEEK: { index: number; short: string; name: string }[] = [
  { index: 1, short: "Mo", name: "Monday" },
  { index: 2, short: "Tu", name: "Tuesday" },
  { index: 3, short: "We", name: "Wednesday" },
  { index: 4, short: "Th", name: "Thursday" },
  { index: 5, short: "Fr", name: "Friday" },
  { index: 6, short: "Sa", name: "Saturday" },
  { index: 0, short: "Su", name: "Sunday" },
];

export function getMotivationalText(streak: number): string {
  if (streak <= 0) {
    return "Finish a conversation today to start your streak.";
  } else if (streak === 1) {
    return "A streak is born. Keep speaking every day to keep it going!";
  } else if (streak < 7) {
    return `${streak} days strong! Keep up the great work!`;
  } else if (streak < 30) {
    return `Amazing! ${streak} days of consistent practice!`;
  } else {
    return `Incredible! ${streak} day streak! You're unstoppable!`;
  }
}

interface StreakWeekProps {
  currentStreak: number;
  weeklyActivity: boolean[];
  isLoading?: boolean;
}

export function StreakWeek({ currentStreak, weeklyActivity, isLoading = false }: StreakWeekProps) {
  const today = new Date().getDay();

  return (
    <section
      aria-labelledby="streak-heading"
      aria-busy={isLoading || undefined}
      className="rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8"
    >
      <h2 id="streak-heading" className="sr-only">
        Your streak
      </h2>
      <div className="flex items-center gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-hot/10 text-hot">
          <Flame className="h-6 w-6" aria-hidden />
        </span>
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-9 w-16 rounded-lg bg-line motion-safe:animate-pulse" />
            <div className="h-3 w-40 rounded bg-line motion-safe:animate-pulse" />
          </div>
        ) : (
          <div className="min-w-0">
            <p className="font-display text-4xl leading-none tabular-nums text-ink">
              {currentStreak}
              <span className="ml-2 font-sans text-base font-medium text-sub">
                day{currentStreak === 1 ? "" : "s"} streak
              </span>
            </p>
            <p className="mt-2 text-sm text-sub">{getMotivationalText(currentStreak)}</p>
          </div>
        )}
      </div>

      <ol aria-label="This week" className="mt-6 grid grid-cols-7 gap-1.5 sm:gap-2.5">
        {WEEK.map((day) => {
          const active = !isLoading && !!weeklyActivity[day.index];
          const isToday = day.index === today;
          return (
            <li key={day.index} className="flex flex-col items-center gap-1.5">
              <span
                aria-hidden
                className={`flex aspect-square w-full max-w-12 items-center justify-center rounded-xl border transition-colors ${
                  active ? "border-accent-brand bg-accent-brand text-white" : "border-line bg-cream"
                } ${isToday ? "ring-2 ring-ink ring-offset-2 ring-offset-surface" : ""}`}
              >
                {active && <Check className="h-4 w-4" strokeWidth={3} />}
              </span>
              <span className={`text-[11px] font-semibold ${isToday ? "text-ink" : "text-sub"}`} aria-hidden>
                {day.short}
              </span>
              <span className="sr-only">
                {day.name}
                {isToday ? " (today)" : ""}: {active ? "practiced" : "not practiced"}
              </span>
            </li>
          );
        })}
      </ol>
    </section>
  );
}
