"use client";

import { Check, MicOff } from "lucide-react";
import type { LanguageAnalysis } from "@/lib/types/conversation";

/**
 * Post-conversation analysis: six 0–100 scores, summary, strengths and
 * corrections. Ported from fina `app/conversation-analysis.tsx` (score labels
 * and ordering) with the web's red-pen correction treatment.
 */

interface AnalysisResultsProps {
  analysis: LanguageAnalysis | null;
  isLoading: boolean;
  durationSeconds: number;
}

type SubScoreKey = "fluency" | "grammar" | "vocabulary" | "engagement" | "relevancy";

const SUB_SCORES: { key: SubScoreKey; label: string }[] = [
  { key: "fluency", label: "Fluency" },
  { key: "grammar", label: "Grammar" },
  { key: "vocabulary", label: "Words" },
  { key: "engagement", label: "Engagement" },
  { key: "relevancy", label: "Relevancy" },
];

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds || 0));
  return `${String(Math.floor(s / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;
}

function clamp(score: number): number {
  return Math.round(Math.min(100, Math.max(0, Number(score) || 0)));
}

/** Colour encodes the band: strong (≥75) green, developing (50–74) ink, needs work (<50) hot. */
function toneClass(score: number): string {
  if (score >= 75) return "bg-accent-brand";
  if (score >= 50) return "bg-ink";
  return "bg-hot";
}

function Bar({ label, value, delayMs = 0, thick = false }: { label: string; value: number; delayMs?: number; thick?: boolean }) {
  return (
    <div
      role="progressbar"
      aria-label={label}
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={100}
      className={`${thick ? "h-2" : "h-1.5"} w-full overflow-hidden rounded-full bg-line`}
    >
      <div
        className={`h-full rounded-full ${toneClass(value)} animate-bar-grow`}
        style={{ width: `${value}%`, animationDelay: `${delayMs}ms` }}
      />
    </div>
  );
}

function isNoSpeech(a: LanguageAnalysis): boolean {
  return (
    a.overall === 0 &&
    a.fluency === 0 &&
    a.grammar === 0 &&
    a.vocabulary === 0 &&
    a.engagement === 0 &&
    a.relevancy === 0 &&
    a.corrections.length === 0 &&
    a.strengths.length === 0
  );
}

const cardClass = "rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8";
const eyebrowClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-sub";

export function AnalysisResults({ analysis, isLoading, durationSeconds }: AnalysisResultsProps) {
  const duration = formatDuration(durationSeconds);

  const durationBlock = (
    <div className="text-right">
      <p className={eyebrowClass}>Duration</p>
      <p className="mt-1 font-display text-2xl tabular-nums text-ink">{duration}</p>
    </div>
  );

  if (isLoading) {
    return (
      <section className={cardClass} aria-busy="true" aria-live="polite">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={eyebrowClass}>Overall</p>
            <div className="mt-2 h-14 w-24 rounded-xl bg-line motion-safe:animate-pulse" />
          </div>
          {durationBlock}
        </div>
        <p className="mt-6 text-sm text-sub">Analysing your conversation…</p>
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          {SUB_SCORES.map((s) => (
            <div key={s.key}>
              <div className="h-3 w-20 rounded bg-line motion-safe:animate-pulse" />
              <div className="mt-3 h-1.5 w-full rounded-full bg-line motion-safe:animate-pulse" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  if (!analysis) {
    return (
      <section className={cardClass} aria-live="polite">
        <div className="flex items-start justify-between gap-4">
          <p className="max-w-sm text-base leading-relaxed text-ink">
            {"We couldn't analyze this conversation, but it still counts toward your streak."}
          </p>
          {durationBlock}
        </div>
      </section>
    );
  }

  if (isNoSpeech(analysis)) {
    return (
      <section className={cardClass} aria-live="polite">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-cream text-sub">
              <MicOff className="h-4 w-4" aria-hidden />
            </span>
            <p className="max-w-sm text-base leading-relaxed text-ink">{analysis.summary}</p>
          </div>
          {durationBlock}
        </div>
      </section>
    );
  }

  const overall = clamp(analysis.overall);

  return (
    <div className="space-y-6" aria-live="polite">
      <section className={cardClass} aria-labelledby="scores-heading">
        <h2 id="scores-heading" className="sr-only">
          Scores
        </h2>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className={eyebrowClass}>Overall</p>
            <p className="mt-1 font-display text-6xl leading-none tabular-nums text-ink sm:text-7xl">
              {overall}
              <span className="ml-1 font-sans text-base font-medium text-sub">/100</span>
            </p>
          </div>
          {durationBlock}
        </div>
        <div className="mt-5">
          <Bar label="Overall" value={overall} thick />
        </div>

        <div className="mt-8 grid gap-x-8 gap-y-5 sm:grid-cols-2">
          {SUB_SCORES.map((s, i) => {
            const value = clamp(analysis[s.key]);
            return (
              <div key={s.key}>
                <div className="mb-2 flex items-baseline justify-between">
                  <span className="text-sm font-medium text-ink">{s.label}</span>
                  <span className="text-sm font-semibold tabular-nums text-ink">{value}</span>
                </div>
                <Bar label={s.label} value={value} delayMs={80 * (i + 1)} />
              </div>
            );
          })}
        </div>

        {analysis.summary && (
          <p className="mt-8 border-t border-line pt-6 text-base leading-relaxed text-ink">
            {analysis.summary}
          </p>
        )}
      </section>

      {analysis.strengths.length > 0 && (
        <section className={cardClass} aria-labelledby="strengths-heading">
          <h2 id="strengths-heading" className="font-display text-2xl text-ink">
            What went well
          </h2>
          <ul className="mt-4 space-y-3">
            {analysis.strengths.map((s, i) => (
              <li key={i} className="flex items-start gap-3 text-[15px] leading-relaxed text-ink">
                <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-accent-soft text-accent-brand">
                  <Check className="h-3 w-3" strokeWidth={3} aria-hidden />
                </span>
                {s}
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={cardClass} aria-labelledby="corrections-heading">
        <h2 id="corrections-heading" className="font-display text-2xl text-ink">
          Worth fixing
        </h2>
        {analysis.corrections.length > 0 ? (
          <ul aria-label="Corrections" className="mt-2">
            {analysis.corrections.map((c, i) => (
              <li key={i} className="border-t border-line py-4 first:border-t-0">
                <p className="text-[15px] leading-relaxed">
                  <span className="sr-only">You said: </span>
                  <del className="text-hot decoration-hot/60 decoration-2">{c.original}</del>
                </p>
                <p className="mt-1 text-[15px] leading-relaxed">
                  <span className="sr-only">Better: </span>
                  <ins className="font-semibold text-accent-brand no-underline">{c.corrected}</ins>
                </p>
                {c.explanation && <p className="mt-1.5 text-sm leading-relaxed text-sub">{c.explanation}</p>}
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-3 text-[15px] leading-relaxed text-sub">
            No corrections this time. Your sentences held up.
          </p>
        )}
      </section>
    </div>
  );
}
