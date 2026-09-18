import type { SupabaseClient } from "@supabase/supabase-js";
import type { ConversationSession, LanguageAnalysis } from "@/lib/types/conversation";

/**
 * The current Fina schema has no conversation-history table. Conversations are
 * therefore transient: the browser receives an id for the active UI flow,
 * while durable progress continues to live in `profiles` through the streak
 * update in the conversations route.
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

export async function listConversations(
  sb: SupabaseClient,
  userId: string,
  limit = 20
): Promise<ConversationSession[]> {
  void sb;
  void userId;
  void limit;
  return [];
}

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
