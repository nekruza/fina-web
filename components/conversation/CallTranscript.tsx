"use client";

import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import Link from "next/link";
import { Check, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { formatTranscript, matchCorrections } from "@/lib/transcripts";
import type { Correction, Message } from "@/lib/types/conversation";

const cardClass = "rounded-[1.75rem] border border-line bg-surface p-6 sm:p-8";
const speakerClass = "text-[11px] font-semibold uppercase tracking-[0.16em] text-sub";

interface CallTranscriptProps {
  messages: Message[];
  tutorName: string;
  /** Corrections from the feedback; null while it is still loading. */
  corrections: Correction[] | null;
  /** Shown under the heading, e.g. whether the transcript is saved. */
  notice?: ReactNode;
}

function CorrectionNote({ correction }: { correction: Correction }) {
  return (
    <div className="mt-2 rounded-xl bg-cream px-3 py-2">
      <p className="text-[15px] leading-relaxed">
        <span className="sr-only">Better: </span>
        <ins className="font-semibold text-accent-brand no-underline">{correction.corrected}</ins>
      </p>
      {correction.explanation && (
        <p className="mt-0.5 text-sm leading-relaxed text-sub">{correction.explanation}</p>
      )}
    </div>
  );
}

/**
 * The read-only transcript of a finished call. Learner lines that the feedback
 * corrected are marked, with the better wording right under them, so learners
 * can see where they found it hard.
 */
export function CallTranscript({ messages, tutorName, corrections, notice }: CallTranscriptProps) {
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const { byIndex, unmatched } = useMemo(
    () => matchCorrections(messages, corrections ?? []),
    [messages, corrections]
  );

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(formatTranscript(messages, tutorName));
      toast.success("Transcript copied");
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy transcript");
    }
  };

  return (
    <section className={cardClass} aria-labelledby="transcript-heading">
      <div className="flex items-start justify-between gap-4">
        <h2 id="transcript-heading" className="font-display text-2xl text-ink">
          Transcript
        </h2>
        {messages.length > 0 && (
          <button
            type="button"
            onClick={handleCopy}
            aria-label="Copy transcript"
            className="inline-flex min-h-10 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink transition-colors hover:bg-cream focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden /> : <Copy className="h-4 w-4" aria-hidden />}
            {copied ? "Copied" : "Copy"}
          </button>
        )}
      </div>

      {notice && <div className="mt-3">{notice}</div>}

      {messages.length === 0 ? (
        <p className="mt-4 text-[15px] leading-relaxed text-sub">Nothing was said in this call.</p>
      ) : (
        <>
          {corrections === null && (
            <p className="mt-4 flex items-center gap-2 text-sm text-sub" aria-live="polite">
              <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
              Marking lines that need work…
            </p>
          )}
          <ol aria-label="Transcript" className="mt-4 space-y-4">
            {messages.map((m, i) => {
              const marks = byIndex.get(i);
              const isUser = m.role === "user";
              return (
                <li
                  key={i}
                  className={marks ? "border-l-2 border-hot pl-3" : isUser ? "border-l-2 border-line pl-3" : "pl-[14px]"}
                >
                  <p className={speakerClass}>
                    {isUser ? "You" : tutorName}
                    {marks && <span className="ml-2 normal-case tracking-normal text-hot">Worth fixing</span>}
                  </p>
                  <p className="mt-1 whitespace-pre-wrap text-[15px] leading-relaxed text-ink">{m.content}</p>
                  {marks?.map((c, j) => <CorrectionNote key={j} correction={c} />)}
                </li>
              );
            })}
          </ol>
        </>
      )}

      {unmatched.length > 0 && (
        <div className="mt-6 border-t border-line pt-5">
          <h3 className="text-sm font-semibold text-ink">Other corrections</h3>
          <ul aria-label="Other corrections" className="mt-2 space-y-3">
            {unmatched.map((c, i) => (
              <li key={i}>
                <p className="text-[15px] leading-relaxed">
                  <span className="sr-only">You said: </span>
                  <del className="text-hot decoration-hot/60 decoration-2">{c.original}</del>
                </p>
                <CorrectionNote correction={c} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

export type TranscriptSaveStatus = "saved" | "saving" | "off" | "error";

/** One line under the transcript heading saying whether it is kept, with the action to keep it. */
export function TranscriptSaveNotice({ status, onKeep }: { status: TranscriptSaveStatus; onKeep: () => void }) {
  const actionClass =
    "inline-flex min-h-10 items-center rounded-full bg-ink px-4 text-sm font-semibold text-surface transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-brand";

  if (status === "saved") {
    return (
      <p className="text-sm text-sub" aria-live="polite">
        <Check className="mr-1 inline h-4 w-4 text-accent-brand" aria-hidden />
        Saved. Read it again anytime in{" "}
        <Link href="/app/progress" className="font-medium text-ink underline underline-offset-2">
          Progress
        </Link>
        .
      </p>
    );
  }

  if (status === "saving") {
    return (
      <p className="flex items-center gap-2 text-sm text-sub" aria-live="polite">
        <Loader2 className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden />
        Saving transcript…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3 rounded-2xl bg-cream p-4 sm:flex-row sm:items-center sm:justify-between">
      <p className="text-sm leading-relaxed text-ink" aria-live="polite">
        {status === "error"
          ? "Couldn't save this transcript."
          : "This transcript disappears when you leave this page."}
      </p>
      <button type="button" onClick={onKeep} className={actionClass}>
        {status === "error" ? "Try again" : "Keep my transcripts"}
      </button>
    </div>
  );
}
