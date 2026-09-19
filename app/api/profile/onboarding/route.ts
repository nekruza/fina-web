import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { updateProfile, ensureStudyPlanStartDate } from "@/lib/db/profile";
import { isLanguageId } from "@/lib/languages";
import { isTutorId } from "@/lib/tutors";
import { onboardingLevelToUserLevel } from "@/lib/levels";

const GOAL_OPTIONS = [5, 10, 20, 30];

// UI IDs differ from the existing profiles.learning_motivation CHECK values.
// Keep the UI/local answers unchanged and translate only at the database boundary.
const PROFILE_MOTIVATIONS = new Map([
  ["travel", "travel"],
  ["work", "career"],
  ["connect", "communication"],
  ["media", "entertainment"],
  ["challenge", "personal"],
  ["academic", "academic"],
  ["career", "career"],
  ["communication", "communication"],
  ["entertainment", "entertainment"],
  ["personal", "personal"],
]);

export async function POST(req: NextRequest) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;

  const { tutor, language, level, motivation, goal } = body ?? {};

  if (!isLanguageId(language)) {
    return NextResponse.json({ error: "Invalid language" }, { status: 400 });
  }

  if (!isTutorId(tutor)) {
    return NextResponse.json({ error: "Invalid tutor" }, { status: 400 });
  }

  if (!GOAL_OPTIONS.includes(goal as number)) {
    return NextResponse.json({ error: "Invalid goal" }, { status: 400 });
  }

  const profileMotivation = typeof motivation === "string"
    ? PROFILE_MOTIVATIONS.get(motivation)
    : null;
  if (profileMotivation === undefined) {
    return NextResponse.json({ error: "Invalid motivation" }, { status: 400 });
  }

  try {
    await updateProfile(supabase, user.id, {
      user_level: onboardingLevelToUserLevel(String(level)),
      target_language: language,
      learning_motivation: profileMotivation,
    });

    await ensureStudyPlanStartDate(supabase, user.id);
  } catch (error) {
    // Supabase errors are plain objects; log useful fields explicitly, excluding
    // `details`, which can contain the user's full profile row.
    const failure = error && typeof error === "object"
      ? error as { code?: unknown; message?: unknown }
      : {};
    console.error("[onboarding] Profile setup failed " + JSON.stringify({
      code: typeof failure.code === "string" ? failure.code : "UNKNOWN",
      message: typeof failure.message === "string" ? failure.message : "Unexpected database error",
    }));
    return NextResponse.json(
      { error: "Unable to save your plan. Please try again." },
      { status: 500 }
    );
  }

  return NextResponse.json({ ok: true });
}
