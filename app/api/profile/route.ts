import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { getProfileRow, updateProfile } from "@/lib/db/profile";
import { conversationStats, countConversations } from "@/lib/db/conversations";
import { getCompletedLessonIds } from "@/lib/db/lessons";
import { getFavoriteIds } from "@/lib/db/favorites";
import { countGeneratedLessons } from "@/lib/db/generatedLessons";
import { countGenerationEvents } from "@/lib/db/generationEvents";
import { buildProfileSummary } from "@/lib/profile-summary";
import { isUserLevel } from "@/lib/levels";
import { isLanguageId } from "@/lib/languages";
import type { ProfileUpdate } from "@/lib/types/profile";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const [row, stats, total, completedLessonIds, favoriteIds, generatedLessonsCount, generationEventsCount] =
    await Promise.all([
      getProfileRow(supabase, user.id),
      conversationStats(supabase, user.id),
      countConversations(supabase, user.id),
      getCompletedLessonIds(supabase, user.id),
      getFavoriteIds(supabase, user.id),
      countGeneratedLessons(supabase, user.id),
      countGenerationEvents(supabase, user.id),
    ]);

  const summary = buildProfileSummary({
    user: { id: user.id, email: user.email, user_metadata: user.user_metadata },
    row,
    conversations: { completed: stats.completed, avgOverallScore: stats.avgOverallScore, total },
    lessonsCompleted: completedLessonIds.size,
    favoriteWords: favoriteIds.size,
    generatedLessons: generatedLessonsCount,
    generationEvents: generationEventsCount,
  });

  return NextResponse.json(summary);
}

export async function PATCH(req: NextRequest) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  const updates: ProfileUpdate = {};

  if ("displayName" in body) {
    const value = typeof body.displayName === "string" ? body.displayName.trim() : "";
    if (!value || value.length > 100) {
      return NextResponse.json({ error: "Invalid displayName" }, { status: 400 });
    }
    updates.display_name = value;
  }

  if ("level" in body) {
    if (!isUserLevel(body.level)) {
      return NextResponse.json({ error: "Invalid level" }, { status: 400 });
    }
    updates.user_level = body.level;
  }

  if ("targetLanguage" in body) {
    if (!isLanguageId(body.targetLanguage)) {
      return NextResponse.json({ error: "Invalid targetLanguage" }, { status: 400 });
    }
    updates.target_language = body.targetLanguage;
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: "Nothing to update" }, { status: 400 });
  }

  await updateProfile(supabase, user.id, updates);

  return NextResponse.json({ ok: true });
}
