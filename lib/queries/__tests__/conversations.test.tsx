/**
 * @jest-environment jsdom
 */
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import {
  putTranscript,
  useConversations,
  useConversationUsage,
  useDeleteAllSavedConversations,
  useDeleteSavedConversation,
  useSavedConversation,
} from "../conversations";
import type { ConversationSession } from "@/lib/types/conversation";

const SESSION: ConversationSession = {
  id: "s1",
  roleplayId: "r1",
  roleplayTitle: "Ordering coffee",
  tutorId: "luna",
  language: "spanish",
  level: "beginner",
  status: "completed",
  startedAt: "2026-09-13T00:00:00.000Z",
  completedAt: "2026-09-13T00:05:00.000Z",
  durationSeconds: 300,
  overallScore: 85,
  analysis: null,
  messageCount: 10,
};

function createWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>;
  };
}

beforeEach(() => {
  global.fetch = jest.fn();
});

describe("useConversations", () => {
  it("fetches from /api/conversations with no query string by default", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sessions: [SESSION] }) });

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual({ sessions: [SESSION] });
    expect(global.fetch).toHaveBeenCalledWith("/api/conversations");
  });

  it("appends the limit as a query param when given", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ sessions: [] }) });

    const { result } = renderHook(() => useConversations(5), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(global.fetch).toHaveBeenCalledWith("/api/conversations?limit=5");
  });

  it("throws on a non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: "Unauthorized" }) });

    const { result } = renderHook(() => useConversations(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

describe("useConversationUsage", () => {
  it("fetches from /api/conversations/usage", async () => {
    const usage = { isPro: false, freeLimit: 3, freeUsed: 1, freeRemaining: 2 };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve(usage) });

    const { result } = renderHook(() => useConversationUsage(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(usage);
    expect(global.fetch).toHaveBeenCalledWith("/api/conversations/usage");
  });

  it("throws on a non-ok response", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 401, json: () => Promise.resolve({ error: "Unauthorized" }) });

    const { result } = renderHook(() => useConversationUsage(), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
  });
});

const PAYLOAD = {
  roleplayId: "r1",
  roleplayTitle: "Ordering coffee",
  tutorId: "luna",
  language: "spanish",
  level: "beginner",
  durationSeconds: 60,
  messages: [{ role: "user" as const, content: "Hola" }],
};

describe("putTranscript", () => {
  it("PUTs the transcript to the call's id and reports success", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    await expect(putTranscript("s1", PAYLOAD)).resolves.toBe(true);

    expect(global.fetch).toHaveBeenCalledWith("/api/conversations/s1", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(PAYLOAD),
      keepalive: false,
    });
  });

  it("uses keepalive when asked and the body is small enough", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: true });

    await putTranscript("s1", PAYLOAD, { keepalive: true });
    expect((global.fetch as jest.Mock).mock.calls[0][1].keepalive).toBe(true);

    const big = { ...PAYLOAD, messages: [{ role: "user" as const, content: "a".repeat(70_000) }] };
    await putTranscript("s1", big, { keepalive: true });
    expect((global.fetch as jest.Mock).mock.calls[1][1].keepalive).toBe(false);
  });

  it("reports failure for a non-ok response or a network error", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 403 });
    await expect(putTranscript("s1", PAYLOAD)).resolves.toBe(false);

    (global.fetch as jest.Mock).mockRejectedValueOnce(new TypeError("offline"));
    await expect(putTranscript("s1", PAYLOAD)).resolves.toBe(false);
  });
});

describe("useSavedConversation", () => {
  it("loads one saved conversation", async () => {
    const conversation = { ...SESSION, messages: [] };
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true, json: () => Promise.resolve({ conversation }) });

    const { result } = renderHook(() => useSavedConversation("s1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(conversation);
    expect(global.fetch).toHaveBeenCalledWith("/api/conversations/s1");
  });

  it("errors with the response status", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: false, status: 404 });

    const { result } = renderHook(() => useSavedConversation("s1"), { wrapper: createWrapper() });

    await waitFor(() => expect(result.current.isError).toBe(true));
    expect((result.current.error as Error & { status: number }).status).toBe(404);
  });
});

describe("deleting saved transcripts", () => {
  it("deletes one transcript", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useDeleteSavedConversation(), { wrapper: createWrapper() });
    await result.current.mutateAsync("s1");

    expect(global.fetch).toHaveBeenCalledWith("/api/conversations/s1", { method: "DELETE" });
  });

  it("deletes all transcripts", async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce({ ok: true });

    const { result } = renderHook(() => useDeleteAllSavedConversations(), { wrapper: createWrapper() });
    await result.current.mutateAsync();

    expect(global.fetch).toHaveBeenCalledWith("/api/conversations", { method: "DELETE" });
  });

  it("throws when a delete fails", async () => {
    (global.fetch as jest.Mock).mockResolvedValue({ ok: false, status: 500 });

    const one = renderHook(() => useDeleteSavedConversation(), { wrapper: createWrapper() });
    await expect(one.result.current.mutateAsync("s1")).rejects.toThrow("Failed to delete transcript");

    const all = renderHook(() => useDeleteAllSavedConversations(), { wrapper: createWrapper() });
    await expect(all.result.current.mutateAsync()).rejects.toThrow("Failed to delete transcripts");
  });
});
