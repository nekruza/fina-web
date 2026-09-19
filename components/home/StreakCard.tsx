"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Check } from "lucide-react";
import { WEEK } from "@/components/conversation/StreakWeek";
import { weekRangeLabel } from "@/lib/study-plan";

/**
 * Home-dashboard streak card. Ported from fina `components/StreakCard.tsx`:
 * week range header, streak number + fire emoji, Monday–Sunday squares, and
 * the zero-streak nudge. The whole card is a link to `/app/roleplay` (fina's
 * `onPress` opened a voice conversation). Shares its Monday-first day
 * mapping with `components/conversation/StreakWeek` rather than
 * re-deriving it.
 *
 * The week-range label and "today" highlight are local-date text, so — like
 * the home greeting — they're only computed after mount (never during the
 * server-rendered pass) to avoid a server/client clock or timezone mismatch.
 * A test-only `now` prop bypasses that deferral for deterministic output.
 */
export interface StreakCardProps {
  currentStreak: number;
  weeklyActivity: boolean[];
  isLoading?: boolean;
  /** Injectable "now" for deterministic week-range labels in tests; otherwise computed after mount. */
  now?: Date;
}

export function StreakCard({ currentStreak, weeklyActivity, isLoading = false, now }: StreakCardProps) {
  const [clientNow, setClientNow] = useState<Date | null>(now ?? null);

  useEffect(() => {
    if (now) return; // caller supplied a deterministic "now" (tests) — nothing to compute.
    async function setMountedNow() {
      setClientNow(new Date());
    }
    setMountedNow();
  }, [now]);

  const today = clientNow?.getDay();
  const weekRange = clientNow ? weekRangeLabel(clientNow) : null;

  return (
    <Link
      href="/app/roleplay"
      className="block rounded-[1.75rem] border border-line bg-surface p-6 transition hover:border-sub/40 hover:shadow-[0_20px_40px_-28px_rgba(27,26,23,0.2)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand sm:p-7"
    >
      {weekRange ? (
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-sub">{weekRange}</p>
      ) : (
        <div className="h-3.5 w-20 rounded bg-line motion-safe:animate-pulse" aria-hidden />
      )}

      <div className="mt-4 flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:justify-between">
        {isLoading ? (
          <div className="space-y-2">
            <div className="h-9 w-20 rounded-lg bg-line motion-safe:animate-pulse" aria-hidden />
            <div className="h-3 w-20 rounded bg-line motion-safe:animate-pulse" aria-hidden />
          </div>
        ) : (
          <div className="min-w-0">
            <p className="font-display text-4xl leading-none text-ink">
              {currentStreak} {currentStreak > 0 ? "🔥" : ""}
            </p>
            <p className="mt-1 text-sm font-medium text-sub">day streak</p>
          </div>
        )}

        <ol aria-label="This week" className="flex w-full justify-between gap-1.5 sm:w-auto sm:justify-normal">
          {WEEK.map((day) => {
            const active = !isLoading && !!weeklyActivity[day.index];
            const isToday = day.index === today;
            return (
              <li key={day.index} className="flex flex-col items-center gap-1.5">
                <span className="text-[11px] font-medium text-sub" aria-hidden>
                  {day.short}
                </span>
                <span
                  aria-hidden
                  className={`flex h-7 w-7 items-center justify-center rounded-lg ${
                    active ? "bg-ink text-white" : "bg-cream"
                  } ${isToday ? "ring-2 ring-accent-brand ring-offset-1 ring-offset-surface" : ""}`}
                >
                  {active && <Check className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />}
                </span>
                <span className="sr-only">
                  {day.name}
                  {isToday ? " (today)" : ""}: {active ? "practised" : "not practised"}
                </span>
              </li>
            );
          })}
        </ol>
      </div>

      {!isLoading && currentStreak === 0 && (
        <p className="mt-4 text-sm text-sub">Start your streak today by having a voice conversation.</p>
      )}
    </Link>
  );
}
