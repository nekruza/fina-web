"use client";

import { useState } from "react";
import Link from "next/link";
import { ChevronDown, Flame, MessageSquare, Star, BookOpen, Heart, Sparkles } from "lucide-react";
import { useProfile } from "@/lib/queries/profile";
import { useConversations } from "@/lib/queries/conversations";
import { StreakCard } from "@/components/home/StreakCard";
import { formatDuration } from "@/components/conversation/AnalysisResults";
import { getLanguage } from "@/lib/languages";

const EMPTY_WEEK: boolean[] = [false, false, false, false, false, false, false];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/**
 * Stats + conversation history. Ported from the mobile progress surfaces
 * (streak, stat tiles) plus a new expandable conversation log the mobile app
 * didn't have — each row expands to show the stored analysis summary and
 * corrections (same red-pen treatment as `AnalysisResults`).
 */
export default function ProgressPage() {
  const { data: profile, isLoading: profileLoading } = useProfile();
  const { data: conversationsData, isLoading: conversationsLoading } = useConversations(20);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const sessions = conversationsData?.sessions ?? [];

  const tiles: { label: string; value: string; icon: typeof Flame }[] = [
    { label: "Current streak", value: String(profile?.streak.current ?? 0), icon: Flame },
    { label: "Conversations", value: String(profile?.stats.conversationsCompleted ?? 0), icon: MessageSquare },
    {
      label: "Avg score",
      value: profile?.stats.avgOverallScore != null ? String(Math.round(profile.stats.avgOverallScore)) : "—",
      icon: Star,
    },
    { label: "Lessons completed", value: String(profile?.stats.lessonsCompleted ?? 0), icon: BookOpen },
    { label: "Favorite words", value: String(profile?.stats.favoriteWords ?? 0), icon: Heart },
    { label: "AI lessons", value: String(profile?.stats.generatedLessons ?? 0), icon: Sparkles },
  ];

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-display text-3xl text-ink">Progress</h1>
      <p className="mt-1.5 text-base text-sub">Your learning journey so far</p>

      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {tiles.map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-line bg-surface p-4">
            <tile.icon className="h-4 w-4 text-accent-brand" aria-hidden />
            <p className="mt-2 font-display text-2xl text-ink">{tile.value}</p>
            <p className="mt-0.5 text-xs text-sub">{tile.label}</p>
          </div>
        ))}
      </div>

      <div className="mt-6">
        <StreakCard
          currentStreak={profile?.streak.current ?? 0}
          weeklyActivity={profile?.streak.weeklyActivity ?? EMPTY_WEEK}
          isLoading={profileLoading}
        />
      </div>

      <section className="mt-8" aria-labelledby="history-heading">
        <h2 id="history-heading" className="font-display text-xl text-ink">
          Conversation history
        </h2>

        {conversationsLoading ? (
          <p role="status" className="mt-4 text-sm text-sub">
            Loading…
          </p>
        ) : sessions.length === 0 ? (
          <div className="mt-6 flex flex-col items-center rounded-3xl border border-line bg-surface px-6 py-12 text-center">
            <p className="text-base text-ink">Conversation history isn’t stored yet</p>
            <p className="mt-2 max-w-sm text-sm text-sub">
              Your streak is saved to your profile while conversation results remain available during the current practice session.
            </p>
            <Link
              href="/app/roleplay"
              className="mt-4 inline-flex items-center justify-center rounded-full bg-ink px-6 py-3 text-sm font-semibold text-cream transition hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
            >
              Start your first conversation
            </Link>
          </div>
        ) : (
          <ul className="mt-4 divide-y divide-line rounded-[1.5rem] border border-line bg-surface">
            {sessions.map((session) => {
              const isOpen = expandedId === session.id;
              const flag = getLanguage(session.language).flag;
              return (
                <li key={session.id}>
                  <button
                    type="button"
                    onClick={() => setExpandedId(isOpen ? null : session.id)}
                    aria-expanded={isOpen}
                    className="flex w-full items-center gap-3 px-4 py-3.5 text-left transition hover:bg-cream focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand sm:px-5"
                  >
                    <span aria-hidden className="text-xl">
                      {flag}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-ink">{session.roleplayTitle}</span>
                      <span className="block text-xs text-sub">
                        {formatDate(session.startedAt)}
                        {session.durationSeconds != null && ` · ${formatDuration(session.durationSeconds)}`}
                      </span>
                    </span>
                    {session.overallScore != null && (
                      <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-semibold text-accent-brand">
                        {Math.round(session.overallScore)}
                      </span>
                    )}
                    <ChevronDown
                      className={`h-4 w-4 shrink-0 text-sub transition-transform ${isOpen ? "rotate-180" : ""}`}
                      aria-hidden
                    />
                  </button>

                  {isOpen && session.analysis && (
                    <div className="border-t border-line bg-cream/50 px-4 py-4 sm:px-5">
                      <p className="text-sm leading-relaxed text-ink">{session.analysis.summary}</p>
                      {session.analysis.corrections.length > 0 && (
                        <ul className="mt-3 space-y-3">
                          {session.analysis.corrections.map((c, i) => (
                            <li key={i}>
                              <p className="text-sm leading-relaxed">
                                <del className="text-hot decoration-hot/60 decoration-2">{c.original}</del>
                              </p>
                              <p className="mt-0.5 text-sm leading-relaxed">
                                <ins className="font-semibold text-accent-brand no-underline">{c.corrected}</ins>
                              </p>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
