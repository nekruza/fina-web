import type { CSSProperties } from "react";
import Image from "next/image";
import Link from "next/link";
import { Languages, Mic } from "lucide-react";
import { getLanguage, LANGUAGES } from "@/lib/languages";
import { getTutorById } from "@/lib/tutors";
import { getRoleplayById } from "@/lib/data/roleplays";
import { TutorTrio } from "./TutorTrio";
import { ctaPrimary, ctaSecondary, shell } from "./styles";

/** Staggered entrance delay for `.fina-rise` (disabled under prefers-reduced-motion). */
const rise = (seconds: number) => ({ "--rise-delay": `${seconds}s` }) as CSSProperties;

const REPLY_SUGGESTIONS = ["A latte, please.", "A small coffee, thanks."];

const ENGLISH_FIRST_LANGUAGES = [
  getLanguage("english"),
  ...LANGUAGES.filter((language) => !language.id.startsWith("english")),
];

/**
 * Static, hand-built preview of a real Fina conversation: Luna running the
 * "Coffee Shop Order" roleplay in English, with the help chip and the "Your
 * turn" state that shows reply suggestions. Nothing in it is interactive.
 */
function ConversationPreview() {
  const luna = getTutorById("luna");
  const english = getLanguage("english");
  const scenario = getRoleplayById("food-cafe-1");

  return (
    <figure className="fina-rise relative mx-auto w-full max-w-[25rem] lg:mr-0" style={rise(0.2)}>
      {/* A second sheet under the card, for depth */}
      <div aria-hidden="true" className="absolute inset-x-5 -bottom-4 top-8 -z-10 rotate-[-3deg] rounded-[28px] bg-line/80" />

      <div className="relative overflow-hidden rounded-[28px] bg-surface shadow-[0_40px_80px_-44px_rgba(27,26,23,0.5)] ring-1 ring-line">
        <div className="flex items-center gap-3 border-b border-line px-5 py-4">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-full bg-line">
            <Image
              src={luna.image}
              alt=""
              width={80}
              height={80}
              sizes="40px"
              priority
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-ink">{luna.name}</p>
            <p className="truncate text-xs text-sub">
              {scenario?.title ?? "Coffee Shop Order"} · {english.label}
            </p>
          </div>
          <span aria-hidden="true" className="text-lg leading-none">
            {english.flag}
          </span>
        </div>

        <div className="space-y-3 px-5 py-6">
          <div className="fina-rise max-w-[88%]" style={rise(0.45)}>
            <p
              lang="en"
              className="w-fit rounded-[20px] rounded-tl-md bg-accent-soft px-4 py-3 font-display fina-display text-[19px] leading-snug text-ink"
            >
              Hi! What would you like to order today?
            </p>
            <p className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-line bg-cream px-3 py-1 text-xs text-sub">
              <Languages aria-hidden="true" strokeWidth={1.75} className="h-3.5 w-3.5 shrink-0" />
              Translation and hints when you need them
            </p>
          </div>

          <p
            lang="en"
            className="fina-rise ml-auto w-fit max-w-[80%] rounded-[20px] rounded-tr-md bg-ink px-4 py-3 text-[15px] leading-snug text-cream"
            style={rise(0.65)}
          >
            A latte with oat milk, please.
          </p>

          <p
            lang="en"
            className="fina-rise w-fit max-w-[88%] rounded-[20px] rounded-tl-md bg-accent-soft px-4 py-3 font-display fina-display text-[19px] leading-snug text-ink"
            style={rise(0.85)}
          >
            Great choice. Small or large?
          </p>
        </div>

        <div className="fina-rise border-t border-line bg-cream/70 px-5 py-5" style={rise(1.05)}>
          <div className="flex items-center gap-4">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-accent-brand text-cream">
              <Mic aria-hidden="true" strokeWidth={1.75} className="h-5 w-5" />
            </span>
            <div>
              <p className="flex items-center gap-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-ink">
                <span aria-hidden="true" className="h-2 w-2 rounded-full bg-hot" />
                Your turn
              </p>
              <p className="mt-0.5 text-xs text-sub">You can say:</p>
            </div>
          </div>
          <ul lang="en" className="mt-3 flex flex-wrap gap-2">
            {REPLY_SUGGESTIONS.map((suggestion) => (
              <li key={suggestion} className="rounded-full border border-line bg-surface px-3 py-1.5 text-[13px] text-ink">
                {suggestion}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <figcaption className="sr-only">
        Example conversation: {luna.name} runs an English coffee-shop roleplay with reply suggestions when it&apos;s your
        turn to speak.
      </figcaption>
    </figure>
  );
}

export function Hero() {
  return (
    <section aria-labelledby="hero-title" className="px-4 pb-20 pt-28 sm:px-6 md:pt-32 lg:pb-28">
      <div className={`${shell} grid items-center gap-16 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)] lg:gap-12`}>
        <div>
          <div className="fina-rise" style={rise(0)}>
            <TutorTrio size={60} priority />
          </div>

          <h1
            id="hero-title"
            className="fina-rise mt-8 pb-2 font-display fina-display text-[clamp(2.75rem,6.2vw,4.75rem)] font-medium leading-[1.04] tracking-[-0.03em] text-ink"
            style={rise(0.08)}
          >
            {/* Two lines on desktop, matching the mobile welcome screen's break. */}
            <span className="block">Speak English</span>{" "}
            <span className="block">
              <em className="italic text-accent-brand">with confidence.</em>
            </span>
          </h1>

          <p
            className="fina-rise mt-5 max-w-[34rem] text-[18px] leading-relaxed text-sub md:text-[19px]"
            style={rise(0.16)}
          >
            Practice real English conversations with Henry, Jake &amp; Luna — AI tutors who meet you at your level and
            help you speak with confidence.
          </p>

          <div className="fina-rise mt-9 flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:gap-3" style={rise(0.24)}>
            <Link href="/onboarding" className={ctaPrimary}>
              Get started
            </Link>
            <Link href="/login" className={ctaSecondary}>
              I already have an account
            </Link>
          </div>

          <div className="fina-rise mt-12" style={rise(0.32)}>
            <p id="hero-languages" className="text-[13px] font-medium text-sub">
              English-first practice for real-life situations
            </p>
            <ul aria-labelledby="hero-languages" className="mt-3 flex max-w-[34rem] flex-wrap gap-2">
              {ENGLISH_FIRST_LANGUAGES.map((language, index) => (
                <li
                  key={language.id}
                  className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[13px] font-medium ${
                    index === 0
                      ? "border-accent-brand/40 bg-accent-soft text-accent-brand"
                      : "border-line bg-surface/70 text-ink"
                  }`}
                >
                  <span aria-hidden="true">{language.flag}</span>
                  {language.label}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <ConversationPreview />
      </div>
    </section>
  );
}
