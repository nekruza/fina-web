"use client";

import { FC, useRef, useEffect, useState } from "react";
import { MessageSquare, Loader2, X, Copy, Check } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "@/lib/types/conversation";
import { getLanguage, type LanguageId } from "@/lib/languages";
import { formatTranscript } from "@/lib/transcripts";

interface TranscriptPanelProps {
  messages: Message[];
  interimTranscript: string;
  /** Highlights the interim block as actively updating (interim-only portion is non-empty). */
  isActivelyListening?: boolean;
  isVisible: boolean;
  tutorName: string;
  nativeLanguage: LanguageId;
  /**
   * "side" (default): the md+ side column. "sheet": the below-md bottom sheet shown
   * above the control bar, so captions and Translate work on phones.
   */
  variant?: "side" | "sheet";
  /** Sheet variant only: closes the sheet (turns Captions off). */
  onClose?: () => void;
}

/** A cached translation, keyed by message index, valid only while the source text is unchanged. */
interface CachedTranslation {
  source: string;
  text: string;
}

export const TranscriptPanel: FC<TranscriptPanelProps> = ({
  messages,
  interimTranscript,
  isActivelyListening = false,
  isVisible,
  tutorName,
  nativeLanguage,
  variant = "side",
  onClose,
}) => {
  const isSheet = variant === "sheet";
  const scrollRef = useRef<HTMLDivElement>(null);
  const [translations, setTranslations] = useState<Record<number, CachedTranslation>>({});
  const [showTranslated, setShowTranslated] = useState<Record<number, boolean>>({});
  const [pending, setPending] = useState<Record<number, boolean>>({});
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const native = getLanguage(nativeLanguage);

  useEffect(() => () => clearTimeout(copiedTimer.current), []);

  const handleCopy = async () => {
    const text = formatTranscript(messages, tutorName);
    try {
      await navigator.clipboard.writeText(text);
      toast.success("Transcript copied");
      setCopied(true);
      clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy transcript");
    }
  };

  useEffect(() => {
    const el = scrollRef.current;
    if (!el || typeof el.scrollTo !== "function") return;
    const reduceMotion =
      typeof window !== "undefined" &&
      window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    el.scrollTo({ top: el.scrollHeight, behavior: reduceMotion ? "auto" : "smooth" });
  }, [messages, interimTranscript, isVisible]);

  const handleTranslate = async (index: number, content: string) => {
    // Currently showing the translation → flip back to the original.
    if (showTranslated[index] && translations[index]?.source === content) {
      setShowTranslated((prev) => ({ ...prev, [index]: false }));
      return;
    }

    const cached = translations[index];
    if (cached && cached.source === content) {
      setShowTranslated((prev) => ({ ...prev, [index]: true }));
      return;
    }

    setPending((prev) => ({ ...prev, [index]: true }));
    try {
      const res = await fetch("/api/ai/translate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: content, targetLanguage: nativeLanguage }),
      });
      if (!res.ok) throw new Error("Translation failed");
      const data = (await res.json()) as { translation?: unknown };
      const text = typeof data.translation === "string" ? data.translation.trim() : "";
      if (!text) throw new Error("Translation failed");

      setTranslations((prev) => ({ ...prev, [index]: { source: content, text } }));
      setShowTranslated((prev) => ({ ...prev, [index]: true }));
    } catch {
      toast.error("Translation failed");
    } finally {
      setPending((prev) => ({ ...prev, [index]: false }));
    }
  };

  if (!isVisible) return null;

  return (
    <div
      role={isSheet ? "region" : undefined}
      aria-label={isSheet ? "Live transcript" : undefined}
      data-variant={variant}
      className={
        isSheet
          ? "md:hidden shrink-0 flex max-h-[45vh] flex-col rounded-2xl bg-[#111723]/95 backdrop-blur-xl border border-white/10 overflow-hidden shadow-2xl shadow-black/40 motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-200"
          : "hidden md:flex w-80 shrink-0 flex-col rounded-2xl bg-white/[0.03] backdrop-blur-md border border-white/[0.06] overflow-hidden"
      }
    >
      {/* Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06]">
        <MessageSquare className="w-3.5 h-3.5 text-white/40" aria-hidden />
        <span className="text-xs font-semibold text-white/50 uppercase tracking-wider">
          Live transcript
        </span>
        <button
          type="button"
          onClick={handleCopy}
          disabled={messages.length === 0}
          aria-label="Copy transcript"
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-white/50"
        >
          {copied ? (
            <Check className="h-4 w-4 text-[#4ade80]" aria-hidden />
          ) : (
            <Copy className="h-4 w-4" aria-hidden />
          )}
        </button>
        {isSheet && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close captions"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/50 transition hover:bg-white/10 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80]"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        )}
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 min-h-0 overflow-y-auto overscroll-contain px-4 py-3 space-y-4">
        {messages.map((msg, i) => {
          const isLatest = i === messages.length - 1;
          const isTutor = msg.role === "assistant";
          const translation = translations[i];
          const isTranslated =
            isTutor && !!showTranslated[i] && translation?.source === msg.content;
          const isPending = !!pending[i];

          return (
            <div
              key={i}
              className="group transition-opacity duration-300 hover:opacity-100 focus-within:opacity-100"
              style={{ opacity: isLatest ? 1 : 0.55 }}
            >
              <div className="flex items-center justify-between gap-2 mb-1">
                <p
                  className="text-[10px] font-semibold uppercase tracking-wider"
                  style={{ color: isTutor ? "rgba(255,255,255,0.5)" : "#4ade80" }}
                >
                  {isTutor ? tutorName : "You"}
                </p>
                {isTutor && (
                  <button
                    type="button"
                    onClick={() => handleTranslate(i, msg.content)}
                    disabled={isPending || !msg.content.trim()}
                    aria-label={isTranslated ? "Show original" : `Translate to ${native.label}`}
                    className="inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-white/60 transition hover:border-white/25 hover:text-white focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#4ade80] disabled:opacity-40"
                  >
                    {isPending && <Loader2 className="w-3 h-3 animate-spin" aria-hidden />}
                    {isTranslated ? "Original" : native.code}
                  </button>
                )}
              </div>
              <p
                className="text-[13px] text-white/85 leading-relaxed"
                lang={isTranslated ? native.locale : undefined}
              >
                {isTranslated ? translation!.text : msg.content}
              </p>
            </div>
          );
        })}
        {interimTranscript && (
          <div className={isActivelyListening ? "motion-safe:animate-pulse" : undefined}>
            <p className="text-[10px] font-semibold uppercase tracking-wider mb-0.5 text-[#4ade80]">
              You
            </p>
            <p className="text-[13px] text-white/50 italic leading-relaxed">{interimTranscript}</p>
          </div>
        )}
      </div>
    </div>
  );
};
