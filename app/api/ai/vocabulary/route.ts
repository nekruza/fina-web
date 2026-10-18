import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { streamLLM } from "@/lib/llm";
import { getProfileRow } from "@/lib/db/profile";
import { findExistingLesson, saveGeneratedLesson } from "@/lib/db/generatedLessons";
import { countGenerationEvents } from "@/lib/db/generationEvents";
import { hasProAccess, FREE_GENERATIONS } from "@/lib/billing";
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { isUserLevel, type UserLevel } from "@/lib/levels";
import {
  validateTopic,
  buildVocabularyPrompt,
  parseGeneratedWords,
  lessonFromWords,
  type WordDifficulty,
} from "@/lib/vocabulary-generation";

export const runtime = "nodejs";

const WORD_COUNT = 12;

function isWordDifficulty(v: unknown): v is WordDifficulty {
  return v === "easy" || v === "medium" || v === "hard";
}

export async function POST(req: NextRequest) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const topic = typeof body?.topic === "string" ? body.topic : "";
  const difficulty = body?.difficulty;

  if (!validateTopic(topic) || !isWordDifficulty(difficulty)) {
    return NextResponse.json({ error: "Invalid topic or difficulty" }, { status: 400 });
  }

  const profileRow = await getProfileRow(supabase, user.id);
  const language: LanguageId = isLanguageId(profileRow?.target_language) ? profileRow!.target_language as LanguageId : "english";
  const level: UserLevel = isUserLevel(profileRow?.user_level) ? profileRow!.user_level as UserLevel : "beginner";

  const existing = await findExistingLesson(supabase, user.id, topic.toLowerCase(), difficulty);
  if (existing) {
    return NextResponse.json({ lesson: existing, reused: true });
  }

  // The current schema counts surviving generated_lessons rows.
  if (!hasProAccess(profileRow)) {
    const count = await countGenerationEvents(supabase, user.id);
    if (count >= FREE_GENERATIONS) {
      return NextResponse.json({ error: "limit_reached" }, { status: 403 });
    }
  }

  try {
    const systemPrompt = buildVocabularyPrompt({ topic, difficulty, count: WORD_COUNT, level, language });

    let fullText = "";
    for await (const chunk of streamLLM({
      systemPrompt,
      messages: [{ role: "user", content: "Generate the vocabulary now." }],
      maxTokens: 4000,
      temperature: 0.7,
    })) {
      fullText += chunk;
    }

    const words = parseGeneratedWords(fullText, topic, difficulty);
    const lesson = lessonFromWords({ id: crypto.randomUUID(), topic, difficulty, words });
    const supabaseId = await saveGeneratedLesson(supabase, user.id, lesson, topic.trim().toLowerCase(), difficulty);

    return NextResponse.json({
      lesson: { ...lesson, supabaseId, isUserGenerated: true },
      reused: false,
    });
  } catch {
    return NextResponse.json({ error: "Could not generate words. Please try again." }, { status: 502 });
  }
}
