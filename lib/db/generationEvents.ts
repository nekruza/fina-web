import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Counts AI vocabulary generations using the current `generated_lessons`
 * table. The project does not have a separate generation-events table, so
 * deleting a lesson also releases that slot in the free allowance.
 */
export async function countGenerationEvents(sb: SupabaseClient, userId: string): Promise<number> {
  const { count, error } = await sb
    .from("generated_lessons")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId);

  if (error) throw error;

  return count ?? 0;
}

/** Retained for the route API; generation usage is represented by the lesson row itself. */
export async function recordGenerationEvent(sb: SupabaseClient, userId: string): Promise<void> {
  void sb;
  void userId;
}
