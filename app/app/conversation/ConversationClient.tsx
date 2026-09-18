"use client";

import { useCallback, useMemo, useRef, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { Languages, Lightbulb, Loader2, Mic } from "lucide-react";
import { VoiceCallView } from "@/components/practice/VoiceCallView";
import { AnalysisResults } from "@/components/conversation/AnalysisResults";
import { StreakWeek } from "@/components/conversation/StreakWeek";
import { ProUpgradeDialog } from "@/components/ProUpgradeDialog";
import { useProfile } from "@/lib/queries/profile";
import { useConversationUsage } from "@/lib/queries/conversations";
import { QUERY_KEYS } from "@/lib/queries/keys";
import { createClient } from "@/lib/supabase/client";
import { getCustomRoleplay } from "@/lib/db/customRoleplays";
import { getRoleplayById } from "@/lib/data/roleplays";
import { customToScenario } from "@/lib/roleplay-filter";
import { getLanguage } from "@/lib/languages";
import { levelLabel } from "@/lib/levels";
import { getTutorById, isTutorId, type Tutor } from "@/lib/tutors";
import { localDateString } from "@/lib/streak";
import { track } from "@/lib/mixpanel";
import type { RoleplayScenario } from "@/lib/types/roleplay";
import type { LanguageAnalysis, Message, Phase } from "@/lib/types/conversation";

interface ConversationClientProps {
  roleplayId: string | null;
  customId: string | null;
  tutorId: string | null;
}

interface StreakSnapshot {
  current: number;
  weeklyActivity: boolean[];
}

const GENERAL: RoleplayScenario = getRoleplayById("general")!;

function castLine(scenario: RoleplayScenario, tutor: Tutor): string {
  if (scenario.id === "general") return "Free conversation";
  return `You: ${scenario.userRole} · ${tutor.name}: ${scenario.aiRole}`;
}

const primaryButton =
  "inline-flex h-12 items-center justify-center gap-2 rounded-full bg-ink px-7 text-[15px] font-semibold text-cream transition hover:bg-ink/90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand disabled:cursor-not-allowed disabled:opacity-60";
const secondaryButton =
  "inline-flex h-12 items-center justify-center rounded-full border border-line bg-surface px-6 text-[15px] font-semibold text-ink transition hover:border-sub/40 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";
const quietLink =
  "inline-flex h-12 items-center justify-center rounded-full px-4 text-[15px] font-semibold text-sub transition hover:text-ink focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand";

export function ConversationClient({ roleplayId, customId, tutorId: tutorParam }: ConversationClientProps) {
  const queryClient = useQueryClient();
  const profileQuery = useProfile();
  const profile = profileQuery.data;
  const usageQuery = useConversationUsage();

  const [phase, setPhase] = useState<Phase>("setup");
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [starting, setStarting] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const [durationSeconds, setDurationSeconds] = useState(0);
  const [analysis, setAnalysis] = useState<LanguageAnalysis | null>(null);
  const [analysisLoading, setAnalysisLoading] = useState(false);
  const [streak, setStreak] = useState<StreakSnapshot | null>(null);
  const [streakLoading, setStreakLoading] = useState(false);
  const completingRef = useRef(false);

  // ── Scenario ──
  const customQuery = useQuery({
    queryKey: [...QUERY_KEYS.customRoleplays, customId],
    enabled: !!customId && !!profile?.id,
    queryFn: async () => {
      const rec = await getCustomRoleplay(createClient(), profile!.id, customId!);
      return rec ? customToScenario(rec) : null;
    },
  });

  const customPending =
    !!customId &&
    (profileQuery.isLoading || (customQuery.isPending && customQuery.fetchStatus === "fetching"));

  const scenario: RoleplayScenario = useMemo(() => {
    if (customId) return customQuery.data ?? GENERAL;
    return getRoleplayById(roleplayId ?? "general") ?? GENERAL;
  }, [customId, customQuery.data, roleplayId]);

  // ── Learner settings ──
  const tutorId = isTutorId(tutorParam) ? tutorParam : profile?.tutorId ?? "luna";
  const tutor = getTutorById(tutorId);
  const language = profile?.targetLanguage ?? "english";
  const level = profile?.level ?? "beginner";
  const nativeLanguage = profile?.nativeLanguage ?? "english";
  const dailyGoalMinutes = profile?.dailyGoalMinutes ?? 10;
  const isPro = usageQuery.data?.isPro ?? profile?.pro.isPro ?? false;
  const freeRemaining =
    usageQuery.data?.freeRemaining ?? profile?.usage.freeConversationsRemaining ?? 0;

  // ── Start ──
  const handleStart = useCallback(async () => {
    if (!profile || starting) return;

    if (!isPro && freeRemaining <= 0) {
      setUpgradeOpen(true);
      return;
    }

    setStarting(true);
    try {
      const res = await fetch("/api/conversations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          roleplayId: scenario.id,
          roleplayTitle: scenario.title,
          tutorId,
          language,
          level,
        }),
      });

      if (res.status === 403) {
        const body = (await res.json().catch(() => ({}))) as { error?: string };
        if (body.error === "limit_reached") {
          setUpgradeOpen(true);
          queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationUsage });
          return;
        }
      }
      if (!res.ok) throw new Error(`HTTP ${res.status}`);

      const { sessionId: id } = (await res.json()) as { sessionId: string };
      completingRef.current = false;
      setSessionId(id);
      setPhase("chat");
      track("Conversation Started", {
        roleplay_id: scenario.id,
        language,
        level,
        tutor_id: tutorId,
      });
    } catch {
      toast.error("Couldn't start the conversation. Check your connection and try again.");
    } finally {
      setStarting(false);
    }
  }, [profile, starting, isPro, freeRemaining, scenario, tutorId, language, level, queryClient]);

  // ── Complete ──
  const handleComplete = useCallback(
    async (messages: Message[], seconds: number) => {
      if (completingRef.current) return;
      completingRef.current = true;

      setPhase("complete");
      setDurationSeconds(seconds);
      setAnalysis(null);
      setAnalysisLoading(true);
      setStreak(null);
      setStreakLoading(true);

      const userMessageCount = messages.filter((m) => m.role === "user" && m.content.trim()).length;

      let result: LanguageAnalysis | null = null;
      try {
        const res = await fetch("/api/ai/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ messages, language, level, durationSeconds: seconds, sessionId }),
        });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        result = (await res.json()) as LanguageAnalysis;
      } catch {
        result = null;
      }
      setAnalysis(result);
      setAnalysisLoading(false);

      if (sessionId) {
        const now = new Date();
        try {
          const res = await fetch("/api/conversations", {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              sessionId,
              durationSeconds: seconds,
              analysis: result,
              messageCount: userMessageCount,
              localDate: localDateString(now),
              dayOfWeek: now.getDay(),
            }),
          });
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          const body = (await res.json()) as { streak?: StreakSnapshot };
          if (body.streak) setStreak(body.streak);
        } catch {
          toast.error("Couldn't save this conversation. Your results are still shown below.");
        }
      }
      setStreakLoading(false);

      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.profile });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversationUsage });

      track("Conversation Completed", {
        roleplay_id: scenario.id,
        language,
        level,
        tutor_id: tutorId,
        duration_seconds: seconds,
        message_count: userMessageCount,
        overall_score: result?.overall ?? null,
      });
    },
    [sessionId, language, level, scenario.id, tutorId, queryClient]
  );

  const handlePracticeAgain = useCallback(() => {
    completingRef.current = false;
    setSessionId(null);
    setAnalysis(null);
    setStreak(null);
    setDurationSeconds(0);
    setPhase("setup");
  }, []);

  // ── Render ──
  if (profileQuery.isError) {
    return (
      <div className="mx-auto max-w-2xl rounded-[1.75rem] border border-line bg-surface p-8">
        <h1 className="font-display text-3xl text-ink">Your profile didn&apos;t load</h1>
        <p className="mt-2 text-sub">Check your connection, then try again.</p>
        <button type="button" onClick={() => profileQuery.refetch()} className={`${primaryButton} mt-6`}>
          Try again
        </button>
      </div>
    );
  }

  if (!profile || customPending) {
    return <SetupSkeleton />;
  }

  if (phase === "chat") {
    return (
      <VoiceCallView
        roleplay={scenario}
        tutorId={tutor.id}
        language={language}
        level={level}
        nativeLanguage={nativeLanguage}
        dailyGoalMinutes={dailyGoalMinutes}
        sessionId={sessionId}
        onComplete={handleComplete}
        onReset={handlePracticeAgain}
      />
    );
  }

  if (phase === "complete") {
    const streakValue = streak ?? {
      current: profile.streak.current,
      weeklyActivity: profile.streak.weeklyActivity,
    };
    return (
      <div className="mx-auto w-full max-w-2xl space-y-6">
        <header>
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sub">
            <span aria-hidden className="text-base">
              {scenario.emoji}
            </span>
            {scenario.title}
          </p>
          <h1 className="mt-2 font-display text-4xl leading-tight text-ink sm:text-5xl">Nice work!</h1>
          <p className="mt-2 text-sub">{castLine(scenario, tutor)}</p>
        </header>

        <AnalysisResults analysis={analysis} isLoading={analysisLoading} durationSeconds={durationSeconds} />
        <StreakWeek
          currentStreak={streakValue.current}
          weeklyActivity={streakValue.weeklyActivity}
          isLoading={streakLoading}
        />

        <div className="flex flex-col gap-3 pt-2 sm:flex-row sm:items-center">
          <button type="button" onClick={handlePracticeAgain} className={primaryButton}>
            Practice again
          </button>
          <Link href="/app/roleplay" className={secondaryButton}>
            Choose another scenario
          </Link>
          <Link href="/app" className={quietLink}>
            Back to home
          </Link>
        </div>
      </div>
    );
  }

  // ── Setup ──
  const lang = getLanguage(language);
  const native = getLanguage(nativeLanguage);
  const isGeneral = scenario.id === "general";

  return (
    <div className="mx-auto w-full max-w-2xl">
      <article className="overflow-hidden rounded-[2rem] border border-line bg-surface">
        <div className="px-6 pt-8 pb-6 sm:px-10 sm:pt-10">
          <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.16em] text-sub">
            <span aria-hidden className="text-base">
              {scenario.emoji}
            </span>
            {isGeneral ? "Open conversation" : `${scenario.difficulty} roleplay`}
          </p>
          <h1 className="mt-3 font-display text-4xl leading-[1.05] text-ink sm:text-5xl">{scenario.title}</h1>
          <p className="mt-3 max-w-prose text-base leading-relaxed text-sub">{scenario.description}</p>
        </div>

        {/* Cast */}
        <div className="mx-6 flex items-center gap-4 rounded-2xl bg-cream px-4 py-4 sm:mx-10 sm:px-5">
          <Image
            src={tutor.image}
            alt={`${tutor.name}, your tutor`}
            width={64}
            height={64}
            className="h-16 w-16 shrink-0 rounded-full object-cover ring-2 ring-surface"
          />
          <div className="min-w-0">
            <p className="font-display text-xl text-ink">{tutor.name}</p>
            <p className="text-sm leading-snug text-sub">{castLine(scenario, tutor)}</p>
          </div>
        </div>

        {/* Session details */}
        <ul aria-label="Session details" className="mx-6 mt-4 flex flex-wrap gap-2 sm:mx-10">
          <li className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink">
            <span aria-hidden>{lang.flag}</span> {lang.label}
          </li>
          <li className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink">
            {levelLabel(level)}
          </li>
          <li className="rounded-full border border-line px-3 py-1.5 text-sm font-medium text-ink">
            {dailyGoalMinutes} min goal
          </li>
        </ul>

        {/* Tips */}
        <div className="mt-8 px-6 sm:px-10">
          <h2 className="text-sm font-semibold text-ink">Before you start</h2>
          <ul className="mt-3 space-y-3 text-[15px] leading-relaxed text-sub">
            <li className="flex gap-3">
              <Mic className="mt-1 h-4 w-4 shrink-0 text-accent-brand" aria-hidden />
              <span>
                Speak out loud in {lang.label}. {tutor.name} listens and replies by voice.
              </span>
            </li>
            <li className="flex gap-3">
              <Lightbulb className="mt-1 h-4 w-4 shrink-0 text-accent-brand" aria-hidden />
              <span>Stuck? Press Get Hint for replies you can say.</span>
            </li>
            <li className="flex gap-3">
              <Languages className="mt-1 h-4 w-4 shrink-0 text-accent-brand" aria-hidden />
              <span>
                Turn on Captions and tap Translate on any line from {tutor.name} to read it in {native.label}.
              </span>
            </li>
          </ul>
        </div>

        <div className="mt-8 flex flex-col-reverse gap-4 border-t border-line px-6 py-6 sm:flex-row sm:items-center sm:justify-between sm:px-10">
          <Link
            href="/app/roleplay"
            className="self-center text-sm font-semibold text-sub underline-offset-4 transition hover:text-ink hover:underline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-brand sm:self-auto"
          >
            Change scenario
          </Link>
          <div className="flex flex-col items-stretch gap-2 sm:items-end">
            <button
              type="button"
              onClick={handleStart}
              disabled={starting}
              aria-busy={starting || undefined}
              className={primaryButton}
            >
              {starting && <Loader2 className="h-4 w-4 animate-spin" aria-hidden />}
              Start conversation
            </button>
            {!isPro && (
              <p className="text-center text-xs text-sub sm:text-right">
                {freeRemaining} free conversation{freeRemaining === 1 ? "" : "s"} left
              </p>
            )}
          </div>
        </div>
      </article>

      <ProUpgradeDialog open={upgradeOpen} onClose={() => setUpgradeOpen(false)} reason="conversations" />
    </div>
  );
}

export function SetupSkeleton() {
  return (
    <div className="mx-auto w-full max-w-2xl" aria-busy="true" aria-label="Loading conversation">
      <div className="rounded-[2rem] border border-line bg-surface px-6 py-10 sm:px-10">
        <div className="h-3 w-32 rounded bg-line motion-safe:animate-pulse" />
        <div className="mt-4 h-10 w-2/3 rounded-lg bg-line motion-safe:animate-pulse" />
        <div className="mt-3 h-4 w-1/2 rounded bg-line motion-safe:animate-pulse" />
        <div className="mt-8 h-24 w-full rounded-2xl bg-cream motion-safe:animate-pulse" />
        <div className="mt-8 h-12 w-48 rounded-full bg-line motion-safe:animate-pulse" />
      </div>
    </div>
  );
}
