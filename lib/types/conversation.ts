/**
 * Conversation / practice-session types.
 *
 * `Message` and `Phase` were previously defined in `lib/practice-data.ts`
 * (interview-only module, now removed) — moved here as the shared shape for
 * both the legacy practice UI (components/practice/*) and the new language
 * conversation flows.
 */

export interface Message {
  role: "user" | "assistant";
  content: string;
}

export type Phase = "setup" | "chat" | "complete";

/** Turn-taking state of a live voice call. */
export type ConversationState =
  | "initializing"
  | "ai_speaking"
  | "listening"
  | "processing"
  | "paused"
  | "ending";

export interface Correction {
  original: string;
  corrected: string;
  explanation: string;
}

export interface LanguageAnalysis {
  overall: number;
  fluency: number;
  grammar: number;
  vocabulary: number;
  engagement: number;
  relevancy: number;
  summary: string;
  strengths: string[];
  corrections: Correction[];
}

export interface ConversationSession {
  id: string;
  roleplayId: string;
  roleplayTitle: string;
  tutorId: string;
  language: string;
  level: string;
  status: "active" | "completed";
  startedAt: string;
  completedAt: string | null;
  durationSeconds: number | null;
  overallScore: number | null;
  analysis: LanguageAnalysis | null;
  messageCount: number | null;
}
