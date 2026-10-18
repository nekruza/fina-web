import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { getProfileRow, updateStreak } from "@/lib/db/profile";
import { createConversation, completeConversation, listConversations, countConversations } from "@/lib/db/conversations";
import { isLanguageId } from "@/lib/languages";
import { isUserLevel } from "@/lib/levels";
import { isTutorId } from "@/lib/tutors";
import { hasProAccess, FREE_CONVERSATIONS } from "@/lib/billing";
import { computeStreakUpdate, isValidDateString, localDateString, parseWeeklyActivity, type StreakState } from "@/lib/streak";
import type { LanguageAnalysis } from "@/lib/types/conversation";

const ROLEPLAY_TITLE_MAX = 120;

function nonEmptyString(v: unknown): v is string {
  return typeof v === "string" && v.trim().length > 0;
}

function clampScore(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n)) return 0;
  return Math.min(100, Math.max(0, n));
}

const MAX_STRENGTHS = 3;
const MAX_CORRECTIONS = 5;

function sanitizeAnalysis(input: unknown): LanguageAnalysis | null {
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

export async function POST(req: NextRequest) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { roleplayId, roleplayTitle, tutorId, language, level } = body ?? {};

  if (
    !nonEmptyString(roleplayId) ||
    !nonEmptyString(roleplayTitle) ||
    roleplayTitle.length > ROLEPLAY_TITLE_MAX ||
    !isTutorId(tutorId) ||
    !isLanguageId(language) ||
    !isUserLevel(level)
  ) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const [row, count] = await Promise.all([getProfileRow(supabase, user.id), countConversations(supabase, user.id)]);

  if (!hasProAccess(row) && count >= FREE_CONVERSATIONS) {
    return NextResponse.json({ error: "limit_reached" }, { status: 403 });
  }

  const sessionId = await createConversation(supabase, user.id, { roleplayId, roleplayTitle, tutorId, language, level });

  return NextResponse.json({ sessionId });
}

export async function PATCH(req: NextRequest) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const { sessionId, durationSeconds, analysis, messageCount, localDate, dayOfWeek } = body ?? {};

  if (!nonEmptyString(sessionId)) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const duration = Number.isFinite(Number(durationSeconds)) ? Math.max(0, Math.round(Number(durationSeconds))) : 0;
  const msgCount = Number.isFinite(Number(messageCount)) ? Math.max(0, Math.round(Number(messageCount))) : 0;

  await completeConversation(supabase, user.id, sessionId, {
    durationSeconds: duration,
    analysis: sanitizeAnalysis(analysis),
    messageCount: msgCount,
  });

  const now = new Date();
  const today = isValidDateString(localDate) ? localDate : localDateString(now);
  const dow =
    Number.isInteger(dayOfWeek) && (dayOfWeek as number) >= 0 && (dayOfWeek as number) <= 6
      ? (dayOfWeek as number)
      : now.getDay();

  const row = await getProfileRow(supabase, user.id);
  const prevState: StreakState = {
    currentStreak: row?.current_streak ?? 0,
    lastConversationDate: row?.last_conversation_date ?? null,
    weeklyActivity: parseWeeklyActivity(row?.weekly_activity ?? null),
  };

  let state = prevState;

  if (msgCount > 0) {
    const result = computeStreakUpdate(prevState, today, dow);
    state = result.state;
    if (result.changed) {
      await updateStreak(supabase, user.id, result.state);
    }
  }

  return NextResponse.json({
    ok: true,
    streak: {
      current: state.currentStreak,
      weeklyActivity: state.weeklyActivity,
      lastConversationDate: state.lastConversationDate,
    },
  });
}

export async function GET(req: NextRequest) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const { searchParams } = new URL(req.url);
  const rawLimit = parseInt(searchParams.get("limit") ?? "20", 10);
  const limit = Number.isFinite(rawLimit) ? Math.min(50, Math.max(1, rawLimit)) : 20;

  const sessions = await listConversations(supabase, user.id, limit);

  return NextResponse.json({ sessions });
}
