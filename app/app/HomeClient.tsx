"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, BookOpen, CalendarDays, MessageSquare, Mic, Sparkles, TrendingUp } from "lucide-react";
import { useProfile, useUpdateProfile } from "@/lib/queries/profile";
import { LanguageLevelSwitcher } from "@/components/home/LanguageLevelSwitcher";
import { StreakCard } from "@/components/home/StreakCard";
import { StudyPlanCard } from "@/components/home/StudyPlanCard";
import { TutorWelcomeCard } from "@/components/home/TutorWelcomeCard";
import { ProUpgradeDialog } from "@/components/ProUpgradeDialog";
import { useFeedbackDialog } from "@/components/FeedbackProvider";
import { DEFAULT_TUTOR_ID, isTutorId } from "@/lib/tutors";
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { isUserLevel, type UserLevel } from "@/lib/levels";

const EMPTY_WEEK: boolean[] = [false, false, false, false, false, false, false];

function greetingForHour(hour: number): string {
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * `/app` home dashboard. Ported from fina `app/(tabs)/index.tsx`: greeting +
 * language/level switcher header, streak card, today's study-plan card, and
 * a quick-actions grid. The greeting is computed after mount so it reflects
 * the visitor's own local hour rather than the server's clock/timezone.
 */
export function HomeClient() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const feedbackDialog = useFeedbackDialog();
  const [greeting, setGreeting] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  useEffect(() => {
    async function computeGreeting() {
      setGreeting(greetingForHour(new Date().getHours()));
    }
    computeGreeting();
  }, []);

  const firstName = profile?.displayName ? profile.displayName.split(" ")[0] : "there";
  const language: LanguageId = isLanguageId(profile?.targetLanguage) ? profile!.targetLanguage : "english";
  const level: UserLevel = isUserLevel(profile?.level) ? profile!.level : "beginner";
  const tutorId = isTutorId(profile?.tutorId) ? profile!.tutorId : DEFAULT_TUTOR_ID;

  function handleLanguageChange(id: LanguageId) {
    updateProfile.mutate({ targetLanguage: id });
  }

  function handleLevelChange(next: UserLevel) {
    updateProfile.mutate({ level: next });
  }

  return (
    <div className="mx-auto max-w-[1180px]">
      <header className="flex flex-col gap-5 border-b border-line pb-7 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Your practice space</p>
          {greeting ? (
            <h1 className="mt-2 font-display text-3xl leading-tight text-ink sm:text-4xl">
              {greeting}, {firstName}
            </h1>
          ) : (
            <div className="mt-2 h-10 w-64 rounded-lg bg-line motion-safe:animate-pulse" aria-hidden />
          )}
          <p className="mt-2 max-w-[52ch] text-sm leading-relaxed text-sub">
            Keep your daily practice moving with a focused speaking session and a few useful words.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {!isLoading && (
            <>
              {profile?.pro.isPro ? (
                <span className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-ink px-3 text-xs font-semibold text-cream">
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Pro plan
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => setUpgradeOpen(true)}
                  className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-accent-brand px-3 text-xs font-semibold text-white transition-[background-color,transform] hover:bg-accent-brand/90 active:translate-y-px focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand"
                >
                  <Sparkles className="h-3 w-3" aria-hidden />
                  Upgrade to Pro
                </button>
              )}
            </>
          )}
          <LanguageLevelSwitcher
            language={language}
            level={level}
            onLanguageChange={handleLanguageChange}
            onLevelChange={handleLevelChange}
          />
        </div>
      </header>

      <TutorWelcomeCard />

      <div className="mt-8 grid gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(320px,0.65fr)]">
        <div className="min-w-0 space-y-6">
          <StreakCard
            currentStreak={profile?.streak.current ?? 0}
            weeklyActivity={profile?.streak.weeklyActivity ?? EMPTY_WEEK}
            isLoading={isLoading}
          />

          {profile && (
            <StudyPlanCard
              userId={profile.id}
              targetLanguage={language}
              tutorId={tutorId}
              studyPlanStartDate={profile.studyPlan.startDate}
              completedDays={profile.studyPlan.completedDays}
            />
          )}
        </div>

        <aside className="min-w-0">
          <section className="rounded-[1.75rem] border border-line bg-surface p-5 sm:p-6" aria-labelledby="quick-start-heading">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-accent-brand">Quick start</p>
                <h2 id="quick-start-heading" className="mt-1 font-display text-xl text-ink">Choose your next step</h2>
              </div>
              <CalendarDays className="mt-1 h-5 w-5 text-sub" aria-hidden />
            </div>

            <div className="mt-5 divide-y divide-line">
              <Link
                href="/app/roleplay"
                className="group flex items-center gap-3 py-3 first:pt-0 last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-brand">
                  <Mic className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">Start speaking</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-sub">Choose a roleplay and practise aloud</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-sub transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>

              <Link
                href="/app/vocabulary"
                className="group flex items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent-brand">
                  <BookOpen className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">Review words</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-sub">Learn and manage your vocabulary</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-sub transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>

              <Link
                href="/app/progress"
                className="group flex items-center gap-3 py-3 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-ink">
                  <TrendingUp className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">See your progress</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-sub">Look back at recent practice</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-sub transition-transform group-hover:translate-x-0.5" aria-hidden />
              </Link>

              <button
                type="button"
                onClick={() => feedbackDialog.open()}
                className="group hidden w-full items-center gap-3 py-3 text-left last:pb-0 focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand md:flex"
              >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-ink">
                  <MessageSquare className="h-5 w-5" aria-hidden />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-semibold text-ink">Share feedback</span>
                  <span className="mt-0.5 block text-xs leading-relaxed text-sub">Help make Fina better</span>
                </span>
                <ArrowRight className="h-4 w-4 shrink-0 text-sub transition-transform group-hover:translate-x-0.5" aria-hidden />
              </button>
            </div>
          </section>
        </aside>
      </div>

      <section className="mt-8 md:hidden" aria-labelledby="mobile-feedback-heading">
        <button
          type="button"
          onClick={() => feedbackDialog.open()}
          className="group flex w-full items-center gap-3 rounded-[1.75rem] border border-line bg-surface p-5 text-left focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent-brand"
        >
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-cream text-ink">
            <MessageSquare className="h-5 w-5" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span id="mobile-feedback-heading" className="block text-sm font-semibold text-ink">Give us feedback</span>
            <span className="mt-0.5 block text-xs leading-relaxed text-sub">Help make Fina better</span>
          </span>
          <ArrowRight className="h-4 w-4 shrink-0 text-sub transition-transform group-hover:translate-x-0.5" aria-hidden />
        </button>
      </section>

      <ProUpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="upgrade" />
    </div>
  );
}
