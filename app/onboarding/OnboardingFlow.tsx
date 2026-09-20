"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";
import { track } from "@/lib/mixpanel";
import { ONBOARDING_LANGUAGE_IDS, LANGUAGE_GREETING, LEVEL_SAMPLES, getLanguage, isLanguageId } from "@/lib/languages";
import { TUTORS, DEFAULT_TUTOR_ID, getTutorById, isTutorId, type TutorId } from "@/lib/tutors";
import {
  LEVEL_OPTIONS,
  LEVEL_LABEL,
  MOTIVATIONS,
  MOTIV_LEAD_IN,
  GOALS,
} from "@/lib/data/onboarding";
import { loadOnboarding, saveOnboarding, type OnboardingData } from "@/lib/onboarding-storage";
import { StepShell } from "@/components/onboarding/StepShell";
import { ChatBubble } from "@/components/onboarding/ChatBubble";
import { OptionRow } from "@/components/onboarding/OptionRow";

type Step = "tutor" | "language" | "level" | "motivation" | "goal" | "complete";

const CHAT_STEP_ORDER: Step[] = ["language", "level", "motivation", "goal"];
const STEP_ORDER: Step[] = ["tutor", ...CHAT_STEP_ORDER];

/** Determines where a returning visitor resumes: the first field not yet saved. */
function resumeStep(data: Partial<OnboardingData>): Step {
  if (!isTutorId(data.tutor)) return "tutor";
  if (!isLanguageId(data.language)) return "language";
  if (!data.level) return "level";
  if (!data.motivation) return "motivation";
  if (typeof data.goal !== "number") return "goal";
  return "complete";
}

export function OnboardingFlow() {
  const router = useRouter();
  const viewedRef = useRef(new Set<string>());
  const headingRef = useRef<HTMLElement | null>(null);
  const isFirstFocusRef = useRef(true);

  // Every field defaults to the fresh-visitor state. Reading localStorage in
  // a useState initializer would run during the server render too (there is
  // no `window` there, so it'd have to guess or throw) and, worse, would
  // make the very first client render disagree with the server-rendered
  // markup — a hydration mismatch. Instead we render this default state on
  // the first paint and resume from storage in a mount-only effect below.
  const [hydrated, setHydrated] = useState(false);
  const [step, setStep] = useState<Step>("tutor");

  const [tutor, setTutor] = useState<TutorId>(DEFAULT_TUTOR_ID);
  const [language, setLanguage] = useState<string | null>(null);
  const [level, setLevel] = useState<string | null>(null);
  const [motivation, setMotivation] = useState<string | null>(null);
  const [goal, setGoal] = useState<number | null>(null);
  const [signedIn, setSignedIn] = useState(false);
  const [signedInChecked, setSignedInChecked] = useState(false);

  // Mount-only: resume from whatever was saved locally, then reveal the flow.
  useEffect(() => {
    function resume() {
      const data = loadOnboarding();
      setStep(resumeStep(data));
      if (isTutorId(data.tutor)) setTutor(data.tutor);
      if (isLanguageId(data.language)) setLanguage(data.language);
      if (data.level) setLevel(data.level);
      if (data.motivation) setMotivation(data.motivation);
      if (typeof data.goal === "number") setGoal(data.goal);
      setHydrated(true);
    }
    resume();
  }, []);

  function trackOnce(key: string, event: string, properties?: Record<string, unknown>) {
    if (viewedRef.current.has(key)) return;
    viewedRef.current.add(key);
    track(event, properties);
  }

  function goBack() {
    const idx = STEP_ORDER.indexOf(step);
    if (idx > 0) setStep(STEP_ORDER[idx - 1]);
  }

  // Moves focus to the new step's heading whenever the step changes, so
  // screen-reader and keyboard users land somewhere meaningful instead of
  // wherever the old step's now-gone Continue button used to be. Skipped
  // the first time the flow becomes visible (fresh mount, or the resume
  // jump right after hydration) — that's not a step "change" a user made.
  useEffect(() => {
    if (!hydrated) return;
    if (isFirstFocusRef.current) {
      isFirstFocusRef.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step, hydrated]);

  // ── Tutor step ────────────────────────────────────────────────
  useEffect(() => {
    if (!hydrated) return;
    if (step === "tutor") trackOnce("tutor", "onboarding_choose_tutor_viewed");
  }, [step, hydrated]);

  function selectTutor(id: TutorId) {
    setTutor(id);
  }

  function continueFromTutor() {
    saveOnboarding({ tutor });
    track("onboarding_tutor_selected", { tutor });
    setStep("language");
  }

  // ── Chat steps (language / level / motivation / goal) ─────────
  useEffect(() => {
    if (!hydrated) return;
    if (step === "language") trackOnce("assessment", "onboarding_assessment_viewed");
  }, [step, hydrated]);

  function selectLanguage(id: string) {
    setLanguage(id);
    saveOnboarding({ language: id as OnboardingData["language"] });
    track("onboarding_language_selected", { language: id });
  }

  function selectLevel(id: string) {
    setLevel(id);
    saveOnboarding({ level: id });
    track("onboarding_level_selected", { level: id });
  }

  function selectMotivation(id: string) {
    setMotivation(id);
    saveOnboarding({ motivation: id });
    track("onboarding_motivation_selected", { motivation: id });
  }

  function selectGoal(min: number) {
    setGoal(min);
    saveOnboarding({ goal: min });
    track("onboarding_goal_selected", { daily_goal_minutes: min });
  }

  function continueChatStep() {
    if (step === "language" && language) setStep("level");
    else if (step === "level" && level) setStep("motivation");
    else if (step === "motivation" && motivation) setStep("goal");
    else if (step === "goal" && goal) {
      track("onboarding_assessment_completed", { language, level, motivation, daily_goal_minutes: goal });
      if (!signedInChecked) return;
      if (signedIn) {
        router.push("/onboarding/complete");
      } else {
        router.push("/signup?next=/onboarding/complete");
      }
    }
  }

  // ── Final plan navigation ────────────────────────────────────
  // The auth check gates both the button's label ("Create my account" vs.
  // "Finish setup") and where it routes, so a signed-in user is never sent
  // to /signup because we guessed too early.
  useEffect(() => {
    if (!hydrated) return;
    let cancelled = false;
    const supabase = createClient();
    supabase.auth
      .getUser()
      .then(({ data }: { data: { user: unknown } }) => {
        if (cancelled) return;
        setSignedIn(Boolean(data.user));
        setSignedInChecked(true);
      })
      .catch((error: unknown) => {
        console.error("Failed to check auth status before onboarding submit:", error);
        if (cancelled) return;
        setSignedIn(false);
        setSignedInChecked(true);
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated]);

  useEffect(() => {
    if (!hydrated || step !== "complete" || !signedInChecked) return;
    router.replace(signedIn ? "/onboarding/complete" : "/signup?next=/onboarding/complete");
  }, [hydrated, router, signedIn, signedInChecked, step]);

  const tutorObj = getTutorById(tutor);

  if (!hydrated) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream" role="status" aria-live="polite">
        <span className="sr-only">Loading…</span>
      </div>
    );
  }

  if (step === "tutor") {
    return (
      <TutorStep headingRef={headingRef} selected={tutor} onSelect={selectTutor} onContinue={continueFromTutor} />
    );
  }

  if (CHAT_STEP_ORDER.includes(step)) {
    const stepIndex = CHAT_STEP_ORDER.indexOf(step) + 1;
    const hasSelection =
      (step === "language" && !!language) ||
      (step === "level" && !!level) ||
      (step === "motivation" && !!motivation) ||
      (step === "goal" && !!goal);
    const canContinue = hasSelection && (step !== "goal" || signedInChecked);
    const continueLabel = step === "goal"
      ? signedIn ? "Finish setup" : "Create my account"
      : "Continue";

    return (
      <StepShell
        tutorId={tutor}
        step={stepIndex}
        total={CHAT_STEP_ORDER.length}
        onBack={goBack}
        footer={
          <PrimaryButton label={continueLabel} onClick={continueChatStep} disabled={!canContinue} />
        }
      >
        {step === "language" && (
          <LanguageStep headingRef={headingRef} tutorName={tutorObj.name} selected={language} onSelect={selectLanguage} />
        )}
        {step === "level" && language && (
          <LevelStep headingRef={headingRef} language={language} selected={level} onSelect={selectLevel} />
        )}
        {step === "motivation" && level && (
          <MotivationStep headingRef={headingRef} level={level} selected={motivation} onSelect={selectMotivation} />
        )}
        {step === "goal" && motivation && (
          <GoalStep headingRef={headingRef} motivation={motivation} selected={goal} onSelect={selectGoal} />
        )}
      </StepShell>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-cream" role="status" aria-live="polite">
      <span className="sr-only">Finishing setup…</span>
    </div>
  );
}

type HeadingRef = RefObject<HTMLElement | null>;

/* ───────── Primary button ───────── */
function PrimaryButton({
  label,
  onClick,
  disabled,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      aria-disabled={disabled}
      className="w-full rounded-2xl bg-ink py-4 text-center text-lg font-semibold text-white transition-opacity disabled:cursor-not-allowed disabled:opacity-35"
    >
      {label}
    </button>
  );
}

/* ───────── Step 1: Tutor ───────── */
function TutorStep({
  headingRef,
  selected,
  onSelect,
  onContinue,
}: {
  headingRef: HeadingRef;
  selected: TutorId;
  onSelect: (id: TutorId) => void;
  onContinue: () => void;
}) {
  const currentName = getTutorById(selected).name;
  return (
    <div className="flex h-[100dvh] flex-col overflow-hidden bg-cream px-5 pt-10 sm:pt-16">
      <div className="mb-6 flex gap-1">
        <div className="h-[3px] flex-1 rounded-full bg-ink" />
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="h-[3px] flex-1 rounded-full bg-line" />
        ))}
      </div>

      <h1
        ref={headingRef as RefObject<HTMLHeadingElement | null>}
        tabIndex={-1}
        className="mb-1.5 font-display text-3xl font-bold text-ink outline-none"
      >
        Pick your tutor
      </h1>
      <p className="mb-6 text-base text-sub">You can switch anytime. All fluent in 9 languages.</p>

      <div role="radiogroup" aria-label="Choose your tutor" className="min-h-0 flex-1 space-y-3 overflow-y-auto pb-32">
        {TUTORS.map((t) => {
          const isSelected = selected === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`${t.name}, ${t.blurb}${isSelected ? ", selected" : ""}`}
              onClick={() => onSelect(t.id)}
              className={`flex w-full items-center rounded-2xl border-2 p-3 text-left transition-colors ${
                isSelected ? "border-ink bg-surface" : "border-line bg-surface"
              }`}
            >
              <span className="relative mr-3.5 block h-[72px] w-[72px] flex-shrink-0 overflow-hidden rounded-2xl bg-accent-soft">
                <Image src={t.image} alt="" fill sizes="72px" className="object-cover" />
              </span>
              <span className="flex-1">
                <span className="mb-0.5 block text-lg font-semibold text-ink">{t.name}</span>
                <span className="block text-sm leading-snug text-sub">{t.blurb}</span>
              </span>
              {isSelected && (
                <span className="ml-2 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div
        className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-cream/95 px-5 pt-3 backdrop-blur-sm"
        style={{ paddingBottom: "max(1.5rem, env(safe-area-inset-bottom))" }}
      >
        <PrimaryButton label={`Continue with ${currentName}`} onClick={onContinue} />
      </div>
    </div>
  );
}

/* ───────── Step 2: Language ───────── */
function LanguageStep({
  headingRef,
  tutorName,
  selected,
  onSelect,
}: {
  headingRef: HeadingRef;
  tutorName: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      {/* Visually hidden — the visible chat bubble below carries the same
          copy. This is the programmatic focus target on step change. */}
      <h2 ref={headingRef as RefObject<HTMLHeadingElement | null>} tabIndex={-1} className="sr-only outline-none">
        Which language do you want to speak?
      </h2>
      <ChatBubble>{`Hey! I'm ${tutorName} 👋`}</ChatBubble>
      <ChatBubble>Which language do you want to speak?</ChatBubble>
      <div role="radiogroup" aria-label="Which language do you want to speak?" className="mt-4 space-y-2">
        {ONBOARDING_LANGUAGE_IDS.map((id) => {
          const lang = getLanguage(id);
          return (
            <OptionRow key={id} selected={selected === id} onSelect={() => onSelect(id)} ariaLabel={lang.label}>
              <span className="flex items-center gap-3">
                <span className="text-xl">{lang.flag}</span>
                <span className="text-base font-medium">{lang.label}</span>
              </span>
            </OptionRow>
          );
        })}
      </div>
    </div>
  );
}

/* ───────── Step 3: Level ───────── */
function LevelStep({
  headingRef,
  language,
  selected,
  onSelect,
}: {
  headingRef: HeadingRef;
  language: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  const lang = getLanguage(language);
  const samples = LEVEL_SAMPLES[language] ?? [];
  return (
    <div>
      <h2 ref={headingRef as RefObject<HTMLHeadingElement | null>} tabIndex={-1} className="sr-only outline-none">
        Where are you starting from?
      </h2>
      <ChatBubble from="you">{`${lang.label} ${lang.flag}`}</ChatBubble>
      <ChatBubble>{LANGUAGE_GREETING[language]}</ChatBubble>
      <ChatBubble>Where are you starting from?</ChatBubble>
      <div role="radiogroup" aria-label="Where are you starting from?" className="mt-4 space-y-2">
        {LEVEL_OPTIONS.map((l, idx) => (
          <OptionRow
            key={l.id}
            selected={selected === l.id}
            onSelect={() => onSelect(l.id)}
            ariaLabel={`${l.label}: ${samples[idx]}`}
          >
            <span className="mb-0.5 block text-[15px] font-semibold">{l.label}</span>
            <span className="block text-[13px] italic opacity-70">&ldquo;{samples[idx]}&rdquo;</span>
          </OptionRow>
        ))}
      </div>
    </div>
  );
}

/* ───────── Step 4: Motivation ───────── */
function MotivationStep({
  headingRef,
  level,
  selected,
  onSelect,
}: {
  headingRef: HeadingRef;
  level: string;
  selected: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div>
      <h2 ref={headingRef as RefObject<HTMLHeadingElement | null>} tabIndex={-1} className="sr-only outline-none">
        What&apos;s pulling you here?
      </h2>
      <ChatBubble>{`Got it — ${LEVEL_LABEL[level]}. 🌱`}</ChatBubble>
      <ChatBubble>{`What's pulling you here?`}</ChatBubble>
      <div role="radiogroup" aria-label="What's pulling you here?" className="mt-4 space-y-2">
        {MOTIVATIONS.map((m) => (
          <OptionRow key={m.id} selected={selected === m.id} onSelect={() => onSelect(m.id)} ariaLabel={`${m.label}: ${m.sub}`}>
            <span className="flex items-center gap-3">
              <span className="text-xl">{m.emoji}</span>
              <span>
                <span className="block text-base font-semibold">{m.label}</span>
                <span className="block text-xs opacity-70">{m.sub}</span>
              </span>
            </span>
          </OptionRow>
        ))}
      </div>
    </div>
  );
}

/* ───────── Step 5: Goal ───────── */
function GoalStep({
  headingRef,
  motivation,
  selected,
  onSelect,
}: {
  headingRef: HeadingRef;
  motivation: string;
  selected: number | null;
  onSelect: (min: number) => void;
}) {
  return (
    <div>
      <h2 ref={headingRef as RefObject<HTMLHeadingElement | null>} tabIndex={-1} className="sr-only outline-none">
        How much time can you give me daily?
      </h2>
      <ChatBubble>{MOTIV_LEAD_IN[motivation]}</ChatBubble>
      <ChatBubble>Here&apos;s the thing — 10 minutes a day beats 2 hours once a week.</ChatBubble>
      <ChatBubble>How much time can you give me daily?</ChatBubble>
      <div role="radiogroup" aria-label="How much time can you give me daily?" className="mt-4 space-y-2">
        {GOALS.map((g) => {
          const isSelected = selected === g.min;
          return (
            <OptionRow
              key={g.min}
              selected={isSelected}
              onSelect={() => onSelect(g.min)}
              ariaLabel={`${g.label} per day, ${g.sub}`}
              badge={
                g.recommended && !isSelected ? (
                  <span className="flex-shrink-0 rounded-full bg-hot px-2 py-1 text-[10px] font-bold tracking-wide text-white">
                    PICK ME
                  </span>
                ) : undefined
              }
            >
              <span className="flex items-center gap-3">
                <span className="text-xl">{g.emoji}</span>
                <span>
                  <span className="block text-base font-semibold">{g.label} / day</span>
                  <span className="block text-xs opacity-70">{g.sub}</span>
                </span>
              </span>
            </OptionRow>
          );
        })}
      </div>
    </div>
  );
}
