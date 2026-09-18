import { createSupabaseMock } from "@/test-utils/supabase-mock";
import {
  createConversation,
  completeConversation,
  listConversations,
  countConversations,
  conversationStats,
  requireActiveSession,
} from "@/lib/db/conversations";
import type { LanguageAnalysis } from "@/lib/types/conversation";

const INPUT = {
  roleplayId: "r1",
  roleplayTitle: "Ordering coffee",
  tutorId: "luna",
  language: "spanish",
  level: "beginner",
};

const ANALYSIS: LanguageAnalysis = {
  overall: 85,
  fluency: 80,
  grammar: 90,
  vocabulary: 88,
  engagement: 82,
  relevancy: 84,
  summary: "Great job",
  strengths: ["clarity"],
  corrections: [],
};

describe("stateless conversations", () => {
  it("creates a local session id without querying a database table", async () => {
    const mock = createSupabaseMock();

    const id = await createConversation(mock as never, "u1", INPUT);

    expect(id).toEqual(expect.any(String));
    expect(id).not.toHaveLength(0);
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("completes without persisting conversation details", async () => {
    const mock = createSupabaseMock();

    await expect(
      completeConversation(mock as never, "u1", "session-1", {
        durationSeconds: 120,
        analysis: ANALYSIS,
        messageCount: 10,
      })
    ).resolves.toBeUndefined();

    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it("returns no history or conversation aggregates because no current table stores them", async () => {
    const mock = createSupabaseMock();

    await expect(listConversations(mock as never, "u1", 5)).resolves.toEqual([]);
    await expect(countConversations(mock as never, "u1")).resolves.toBe(0);
    await expect(conversationStats(mock as never, "u1")).resolves.toEqual({ completed: 0, avgOverallScore: null });
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });
});

describe("requireActiveSession", () => {
  it("accepts a non-empty session id without querying a database table", async () => {
    const mock = createSupabaseMock();

    await expect(requireActiveSession(mock as never, "u1", "session-1")).resolves.toEqual({ ok: true });
    expect(mock.callCountFor("conversation_sessions")).toBe(0);
  });

  it.each([undefined, null, "", 42, { id: "session-1" }])(
    "rejects a missing or non-string session id (%p)",
    async (sessionId) => {
      const mock = createSupabaseMock();

      await expect(requireActiveSession(mock as never, "u1", sessionId)).resolves.toEqual({
        ok: false,
        error: "invalid_session",
      });
      expect(mock.callCountFor("conversation_sessions")).toBe(0);
    }
  );
});
