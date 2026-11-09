import type { Correction, LanguageAnalysis, Message } from "@/lib/types/conversation";

/** Longest single turn we store. Spoken turns are far shorter; this stops abuse. */
export const MAX_MESSAGE_CHARS = 4000;
/** Most turns we store for one call. */
export const MAX_MESSAGES = 300;

const BEGIN_RE = /^\[BEGIN\]/i;

/** Drops the auto-sent "[BEGIN]" greeting trigger so it never reaches the UI, the analysis or the saved transcript. */
export function stripBeginMarker(msgs: Message[]): Message[] {
  return msgs.filter((m) => !(m.role === "user" && BEGIN_RE.test(m.content.trim())));
}

/**
 * Checks a transcript sent by the browser. Returns the cleaned turns (trimmed,
 * empty turns and the [BEGIN] marker removed, extra fields dropped), or null if
 * anything is malformed or over the limits.
 */
export function sanitizeMessages(input: unknown): Message[] | null {
  if (!Array.isArray(input) || input.length > MAX_MESSAGES) return null;
  const out: Message[] = [];
  for (const item of input) {
    if (!item || typeof item !== "object") return null;
    const { role, content } = item as Record<string, unknown>;
    if (role !== "user" && role !== "assistant") return null;
    if (typeof content !== "string" || content.length > MAX_MESSAGE_CHARS) return null;
    const trimmed = content.trim();
    if (trimmed) out.push({ role, content: trimmed });
  }
  return stripBeginMarker(out);
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

const MAX_STRENGTHS = 3;
const MAX_CORRECTIONS = 5;

/** Shapes an analysis sent by the browser into a LanguageAnalysis, or null if it isn't an object. */
export function sanitizeAnalysis(input: unknown): LanguageAnalysis | null {
  if (input == null || typeof input !== "object" || Array.isArray(input)) return null;
  const a = input as Record<string, unknown>;

  const strengths = Array.isArray(a.strengths) ? a.strengths.slice(0, MAX_STRENGTHS).map((s) => String(s)) : [];
  const corrections = Array.isArray(a.corrections)
    ? a.corrections.slice(0, MAX_CORRECTIONS).map((c) => {
        const rec = (c ?? {}) as Record<string, unknown>;
        return {
          original: String(rec.original ?? ""),
          corrected: String(rec.corrected ?? ""),
          explanation: String(rec.explanation ?? ""),
        };
      })
    : [];

  return {
    overall: clampScore(a.overall),
    fluency: clampScore(a.fluency),
    grammar: clampScore(a.grammar),
    vocabulary: clampScore(a.vocabulary),
    engagement: clampScore(a.engagement),
    relevancy: clampScore(a.relevancy),
    summary: typeof a.summary === "string" ? a.summary : "",
    strengths,
    corrections,
  };
}

function normalize(text: string): string {
  return text
    .toLocaleLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export interface CorrectionMatches {
  /** Corrections keyed by the index of the learner message they belong to. */
  byIndex: Map<number, Correction[]>;
  /** Corrections whose original text does not appear in any learner message. */
  unmatched: Correction[];
}

/**
 * Places each correction on the first learner line that contains its original
 * wording (ignoring case and punctuation), so the transcript can show where
 * the learner found it hard. Tutor lines are never marked.
 */
export function matchCorrections(messages: Message[], corrections: Correction[]): CorrectionMatches {
  const learnerLines = messages
    .map((m, index) => ({ index, role: m.role, text: ` ${normalize(m.content)} ` }))
    .filter((m) => m.role === "user");

  const byIndex = new Map<number, Correction[]>();
  const unmatched: Correction[] = [];

  for (const c of corrections) {
    const needle = normalize(c.original);
    const line = needle ? learnerLines.find((m) => m.text.includes(` ${needle} `)) : undefined;
    if (!line) {
      unmatched.push(c);
      continue;
    }
    byIndex.set(line.index, [...(byIndex.get(line.index) ?? []), c]);
  }

  return { byIndex, unmatched };
}

/** Plain-text transcript for the clipboard: "Luna: …\nYou: …". */
export function formatTranscript(messages: Message[], tutorName: string): string {
  return messages.map((m) => `${m.role === "assistant" ? tutorName : "You"}: ${m.content}`).join("\n");
}
