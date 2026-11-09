import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { getProfileRow } from "@/lib/db/profile";
import {
  deleteSavedConversation,
  getSavedConversation,
  upsertSavedConversation,
} from "@/lib/db/conversations";
import { isLanguageId } from "@/lib/languages";
import { isUserLevel } from "@/lib/levels";
import { isTutorId } from "@/lib/tutors";
import { sanitizeAnalysis, sanitizeMessages } from "@/lib/transcripts";
import type { SaveTranscriptInput } from "@/lib/types/conversation";

type Params = { params: Promise<{ id: string }> };

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ROLEPLAY_ID_MAX = 100;
const ROLEPLAY_TITLE_MAX = 200;

function boundedString(v: unknown, max: number): v is string {
  return typeof v === "string" && v.trim().length > 0 && v.length <= max;
}

function parseSaveBody(body: Record<string, unknown> | null): SaveTranscriptInput | null {
  if (!body || typeof body !== "object") return null;
  const { roleplayId, roleplayTitle, tutorId, language, level, durationSeconds } = body;
  if (
    !boundedString(roleplayId, ROLEPLAY_ID_MAX) ||
    !boundedString(roleplayTitle, ROLEPLAY_TITLE_MAX) ||
    !isTutorId(tutorId) ||
    !isLanguageId(language) ||
    !isUserLevel(level)
  ) {
    return null;
  }

  const messages = sanitizeMessages(body.messages);
  if (!messages) return null;

  const seconds = Number(durationSeconds);
  const input: SaveTranscriptInput = {
    roleplayId,
    roleplayTitle: roleplayTitle.trim(),
    tutorId,
    language,
    level,
    durationSeconds: Number.isFinite(seconds) ? Math.max(0, Math.round(seconds)) : 0,
    messages,
  };
  if ("analysis" in body) input.analysis = sanitizeAnalysis(body.analysis);
  return input;
}

/**
 * Saves (or re-saves) the transcript of call `id`. Only works when the learner
 * has transcript saving switched on; the setting is read here rather than
 * trusted from the browser.
 */
export async function PUT(req: NextRequest, { params }: Params) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;

  const body = (await req.json().catch(() => null)) as Record<string, unknown> | null;
  const input = UUID_RE.test(id) ? parseSaveBody(body) : null;
  if (!input) return NextResponse.json({ error: "Invalid transcript" }, { status: 400 });

  try {
    const profile = await getProfileRow(supabase, user.id);
    if (profile?.save_transcripts !== true) {
      return NextResponse.json({ error: "saving_off" }, { status: 403 });
    }
    await upsertSavedConversation(supabase, user.id, id, input);
  } catch (err) {
    console.error("[api/conversations/:id] save error:", err);
    return NextResponse.json({ error: "Failed to save transcript" }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

export async function GET(_req: NextRequest, { params }: Params) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const conversation = await getSavedConversation(supabase, user.id, id);
    if (!conversation) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ conversation });
  } catch (err) {
    console.error("[api/conversations/:id] load error:", err);
    return NextResponse.json({ error: "Failed to load transcript" }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;
  const { id } = await params;
  if (!UUID_RE.test(id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    await deleteSavedConversation(supabase, user.id, id);
  } catch (err) {
    console.error("[api/conversations/:id] delete error:", err);
    return NextResponse.json({ error: "Failed to delete transcript" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
