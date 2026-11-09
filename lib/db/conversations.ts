import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  ConversationSession,
  LanguageAnalysis,
  Message,
  SavedConversation,
  SaveTranscriptInput,
} from "@/lib/types/conversation";

/**
 * Calls themselves are transient: the browser receives an id for the active
 * UI flow, and durable progress lives in `profiles` through the streak update
 * in the conversations route. Only learners who switch on transcript saving
 * get a row in `saved_conversations` (see below).
 */
export async function createConversation(
  sb: SupabaseClient,
  userId: string,
  input: { roleplayId: string; roleplayTitle: string; tutorId: string; language: string; level: string }
): Promise<string> {
  void sb;
  void userId;
  void input;
  return crypto.randomUUID();
}

export async function completeConversation(
  sb: SupabaseClient,
  userId: string,
  id: string,
  input: { durationSeconds: number; analysis: LanguageAnalysis | null; messageCount: number }
): Promise<void> {
  void sb;
  void userId;
  void id;
  void input;
}

const SAVED = "saved_conversations";

/** Every column except the transcript itself, for history lists. */
const SUMMARY_COLUMNS =
  "id, roleplay_id, roleplay_title, tutor_id, language, level, duration_seconds, message_count, analysis, created_at, updated_at";

interface SavedConversationRow {
  id: string;
  roleplay_id: string;
  roleplay_title: string;
  tutor_id: string;
  language: string;
  level: string;
  duration_seconds: number;
  message_count: number;
  analysis: LanguageAnalysis | null;
  messages?: Message[];
  created_at: string;
  updated_at: string;
}

function toSession(row: SavedConversationRow): ConversationSession {
  return {
    id: row.id,
    roleplayId: row.roleplay_id,
    roleplayTitle: row.roleplay_title,
    tutorId: row.tutor_id,
    language: row.language,
    level: row.level,
    status: "completed",
    startedAt: row.created_at,
    completedAt: row.updated_at,
    durationSeconds: row.duration_seconds,
    overallScore: row.analysis?.overall ?? null,
    analysis: row.analysis,
    messageCount: row.message_count,
  };
}

/**
 * Conversation history: the calls the learner chose to keep (transcript saving
 * is opt-in, see profiles.save_transcripts). Calls made with saving off are
 * not stored anywhere, so they never appear here.
 */
export async function listConversations(
  sb: SupabaseClient,
  userId: string,
  limit = 20
): Promise<ConversationSession[]> {
  const { data, error } = await sb
    .from(SAVED)
    .select(SUMMARY_COLUMNS)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return ((data ?? []) as SavedConversationRow[]).map(toSession);
}

export async function getSavedConversation(
  sb: SupabaseClient,
  userId: string,
  id: string
): Promise<SavedConversation | null> {
  const { data, error } = await sb
    .from(SAVED)
    .select(`${SUMMARY_COLUMNS}, messages`)
    .eq("id", id)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const row = data as SavedConversationRow;
  return { ...toSession(row), messages: row.messages ?? [] };
}

/**
 * Saves a call's transcript, or updates it when the same call is saved again
 * (for example once feedback arrives). The caller must have checked that the
 * learner has saving switched on.
 */
export async function upsertSavedConversation(
  sb: SupabaseClient,
  userId: string,
  id: string,
  input: SaveTranscriptInput
): Promise<void> {
  const row: Record<string, unknown> = {
    id,
    user_id: userId,
    roleplay_id: input.roleplayId,
    roleplay_title: input.roleplayTitle,
    tutor_id: input.tutorId,
    language: input.language,
    level: input.level,
    duration_seconds: input.durationSeconds,
    message_count: input.messages.filter((m) => m.role === "user").length,
    messages: input.messages,
    updated_at: new Date().toISOString(),
  };
  // Leaving the key out keeps whatever analysis is already stored.
  if (input.analysis !== undefined) row.analysis = input.analysis;

  const { error } = await sb.from(SAVED).upsert(row, { onConflict: "id" });
  if (error) throw error;
}

export async function deleteSavedConversation(sb: SupabaseClient, userId: string, id: string): Promise<void> {
  const { error } = await sb.from(SAVED).delete().eq("id", id).eq("user_id", userId);
  if (error) throw error;
}

export async function deleteAllSavedConversations(sb: SupabaseClient, userId: string): Promise<void> {
  const { error } = await sb.from(SAVED).delete().eq("user_id", userId);
  if (error) throw error;
}

/**
 * Stays at 0: the free-tier allowance has never been enforced from stored
 * calls, and counting saved transcripts would wrongly penalise learners who
 * opt in to saving.
 */
export async function countConversations(sb: SupabaseClient, userId: string): Promise<number> {
  void sb;
  void userId;
  return 0;
}

export async function conversationStats(
  sb: SupabaseClient,
  userId: string
): Promise<{ completed: number; avgOverallScore: number | null }> {
  void sb;
  void userId;
  return { completed: 0, avgOverallScore: null };
}

export type ActiveSessionCheck = { ok: true } | { ok: false; error: "invalid_session" };

/**
 * Authentication still protects the AI routes. Since there is no current
 * table for server-side conversation sessions, this only validates the
 * transient id issued by the start route and does not claim ownership or age
 * guarantees that require persisted session rows.
 */
export async function requireActiveSession(
  sb: SupabaseClient,
  userId: string,
  sessionId: unknown
): Promise<ActiveSessionCheck> {
  void sb;
  void userId;
  return typeof sessionId === "string" && sessionId.length > 0 ? { ok: true } : { ok: false, error: "invalid_session" };
}
