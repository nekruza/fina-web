import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { QUERY_KEYS } from "./keys";
import type { ConversationSession, SavedConversation, SaveTranscriptInput } from "@/lib/types/conversation";

interface ConversationsResponse {
  sessions: ConversationSession[];
}

interface ConversationUsage {
  isPro: boolean;
  freeLimit: number;
  freeUsed: number;
  freeRemaining: number;
}

async function fetchConversations(limit?: number): Promise<ConversationsResponse> {
  const url = limit != null ? `/api/conversations?limit=${limit}` : "/api/conversations";
  const res = await fetch(url);
  if (!res.ok) throw Object.assign(new Error("Failed to fetch conversations"), { status: res.status });
  return res.json();
}

export function useConversations(limit?: number) {
  return useQuery({
    queryKey: limit != null ? [...QUERY_KEYS.conversations, limit] : QUERY_KEYS.conversations,
    queryFn: () => fetchConversations(limit),
  });
}

async function fetchConversationUsage(): Promise<ConversationUsage> {
  const res = await fetch("/api/conversations/usage");
  if (!res.ok) throw Object.assign(new Error("Failed to fetch conversation usage"), { status: res.status });
  return res.json();
}

export function useConversationUsage() {
  return useQuery({
    queryKey: QUERY_KEYS.conversationUsage,
    queryFn: fetchConversationUsage,
  });
}

/** Browsers refuse keepalive requests with bodies over 64 KiB; stay safely under it. */
const KEEPALIVE_MAX_CHARS = 60_000;

/**
 * Saves (or re-saves) a call's transcript. Resolves to whether it was stored;
 * never throws. `keepalive` lets the request finish while the page closes.
 */
export async function putTranscript(
  sessionId: string,
  payload: SaveTranscriptInput,
  opts: { keepalive?: boolean } = {}
): Promise<boolean> {
  const body = JSON.stringify(payload);
  try {
    const res = await fetch(`/api/conversations/${sessionId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: Boolean(opts.keepalive) && body.length <= KEEPALIVE_MAX_CHARS,
    });
    return res.ok;
  } catch {
    return false;
  }
}

async function fetchSavedConversation(id: string): Promise<SavedConversation> {
  const res = await fetch(`/api/conversations/${id}`);
  if (!res.ok) throw Object.assign(new Error("Failed to fetch transcript"), { status: res.status });
  const body = (await res.json()) as { conversation: SavedConversation };
  return body.conversation;
}

export function useSavedConversation(id: string) {
  return useQuery({
    // Nested under `conversations` so invalidating history refreshes this too.
    queryKey: [...QUERY_KEYS.conversations, "saved", id],
    queryFn: () => fetchSavedConversation(id),
    retry: false,
  });
}

export function useDeleteSavedConversation() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/conversations/${id}`, { method: "DELETE" });
      if (!res.ok) throw Object.assign(new Error("Failed to delete transcript"), { status: res.status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations }),
  });
}

export function useDeleteAllSavedConversations() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/conversations", { method: "DELETE" });
      if (!res.ok) throw Object.assign(new Error("Failed to delete transcripts"), { status: res.status });
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: QUERY_KEYS.conversations }),
  });
}
