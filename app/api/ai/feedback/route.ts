import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { streamLLM } from "@/lib/llm";
import { requireActiveSession } from "@/lib/db/conversations";
import { buildAnalysisPrompt } from "@/lib/utils/buildConversationInstructions";
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { isUserLevel, type UserLevel } from "@/lib/levels";
import type { Correction, LanguageAnalysis } from "@/lib/types/conversation";

export const runtime = "nodejs";

interface FeedbackMessage {
  role: string;
  content: string;
}

// A user message is a real learner answer only if it is not an auto-generated
// session marker ("[BEGIN]" from the realtime greeting handshake, or the
// legacy "[SESSION START]" marker).
const IGNORED_USER_RE = /^\[(BEGIN|SESSION START)\]/i;

function isRealUserMessage(m: FeedbackMessage): boolean {
  return m.role === "user" && !IGNORED_USER_RE.test(m.content.trim());
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(Number(totalSeconds) || 0));
  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;
  return `${minutes}:${remainder.toString().padStart(2, "0")}`;
}

const NO_SPEECH_RESULT: LanguageAnalysis = {
  overall: 0,
  fluency: 0,
  grammar: 0,
  vocabulary: 0,
  engagement: 0,
  relevancy: 0,
  summary:
    "We didn't catch any speech this time. Check your microphone and try speaking a few sentences next session.",
  strengths: [],
  corrections: [],
};

const FALLBACK_RESULT: LanguageAnalysis = {
  overall: 70,
  fluency: 70,
  grammar: 70,
  vocabulary: 70,
  engagement: 70,
  relevancy: 70,
  summary:
    "Analysis is unavailable right now, but your practice still counts toward your streak.",
  strengths: [],
  corrections: [],
};

export async function POST(req: NextRequest) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const { messages, language, level, durationSeconds, sessionId } = await req.json();

  // Grading runs before PATCH /api/conversations marks the session completed,
  // so the session is still active here.
  const session = await requireActiveSession(supabase, user.id, sessionId);
  if (!session.ok) {
    return NextResponse.json({ error: session.error }, { status: 403 });
  }

  if (!messages || !Array.isArray(messages)) {
    return NextResponse.json(NO_SPEECH_RESULT);
  }

  const realUserMessages = (messages as FeedbackMessage[]).filter(isRealUserMessage);
  if (realUserMessages.length === 0) {
    return NextResponse.json(NO_SPEECH_RESULT);
  }

  const resolvedLanguage: LanguageId = isLanguageId(language) ? language : "english";
  const resolvedLevel: UserLevel = isUserLevel(level) ? level : "beginner";

  const transcriptLines = (messages as FeedbackMessage[])
    .filter((m) => m.role === "assistant" || isRealUserMessage(m))
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n\n");
  const transcript = `${transcriptLines}\n\nDuration: ${formatDuration(durationSeconds)}`;

  try {
    const systemPrompt = buildAnalysisPrompt(resolvedLanguage, resolvedLevel);

    let fullText = "";
    for await (const chunk of streamLLM({
      systemPrompt,
      messages: [{ role: "user", content: transcript }],
      maxTokens: 2000,
      temperature: 0.3,
    })) {
      fullText += chunk;
    }

    const stripped = fullText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim();

    const parsed = JSON.parse(stripped);

    const clampScore = (val: unknown) => Math.min(100, Math.max(0, Math.round(Number(val))));

    const strengths: string[] = Array.isArray(parsed.strengths)
      ? parsed.strengths.slice(0, 3).map((s: unknown) => String(s))
      : [];

    const corrections: Correction[] = Array.isArray(parsed.corrections)
      ? parsed.corrections.slice(0, 5).map((c: Record<string, unknown>) => ({
          original: String(c.original ?? ""),
          corrected: String(c.corrected ?? ""),
          explanation: String(c.explanation ?? ""),
        }))
      : [];

    const result: LanguageAnalysis = {
      overall: clampScore(parsed.overall),
      fluency: clampScore(parsed.fluency),
      grammar: clampScore(parsed.grammar),
      vocabulary: clampScore(parsed.vocabulary),
      engagement: clampScore(parsed.engagement),
      relevancy: clampScore(parsed.relevancy),
      summary: String(parsed.summary ?? ""),
      strengths,
      corrections,
    };

    return NextResponse.json(result);
  } catch {
    return NextResponse.json(FALLBACK_RESULT);
  }
}
