import { createSupabaseMock, writePayload } from "@/test-utils/supabase-mock";
import {
  createConversation,
  completeConversation,
  listConversations,
  countConversations,
  conversationStats,
  requireActiveSession,
  getSavedConversation,
  upsertSavedConversation,
  deleteSavedConversation,
  deleteAllSavedConversations,
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

  it("keeps usage counts and aggregates at zero so saving transcripts never changes the free-tier limit", async () => {
    const mock = createSupabaseMock();

    await expect(countConversations(mock as never, "u1")).resolves.toBe(0);
    await expect(conversationStats(mock as never, "u1")).resolves.toEqual({ completed: 0, avgOverallScore: null });
    expect(mock.calls).toHaveLength(0);
  });
});

const ROW = {
  id: "11111111-1111-4111-8111-111111111111",
  user_id: "u1",
  roleplay_id: "r1",
  roleplay_title: "Ordering coffee",
  tutor_id: "luna",
  language: "spanish",
  level: "beginner",
  duration_seconds: 120,
  message_count: 2,
  analysis: ANALYSIS,
  created_at: "2026-11-09T10:00:00.000Z",
  updated_at: "2026-11-09T10:02:00.000Z",
};

const MESSAGES = [
  { role: "assistant" as const, content: "Hola" },
  { role: "user" as const, content: "Un café, por favor" },
];

describe("saved conversations", () => {
  it("lists the user's saved conversations newest first, without transcripts", async () => {
    const mock = createSupabaseMock({ tables: { saved_conversations: { data: [ROW], error: null } } });

    const sessions = await listConversations(mock as never, "u1", 5);

    const b = mock.builderFor("saved_conversations");
    expect(b.select).toHaveBeenCalledWith(expect.not.stringContaining("messages"));
    expect(b.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(b.order).toHaveBeenCalledWith("created_at", { ascending: false });
    expect(b.limit).toHaveBeenCalledWith(5);
    expect(sessions).toEqual([
      {
        id: ROW.id,
        roleplayId: "r1",
        roleplayTitle: "Ordering coffee",
        tutorId: "luna",
        language: "spanish",
        level: "beginner",
        status: "completed",
        startedAt: ROW.created_at,
        completedAt: ROW.updated_at,
        durationSeconds: 120,
        overallScore: 85,
        analysis: ANALYSIS,
        messageCount: 2,
      },
    ]);
  });

  it("returns an empty list when nothing is saved and throws on database errors", async () => {
    const empty = createSupabaseMock({ tables: { saved_conversations: { data: null, error: null } } });
    await expect(listConversations(empty as never, "u1")).resolves.toEqual([]);

    const broken = createSupabaseMock({ tables: { saved_conversations: { error: { message: "boom" } } } });
    await expect(listConversations(broken as never, "u1")).rejects.toEqual({ message: "boom" });
  });

  it("gets one saved conversation with its transcript, scoped to the owner", async () => {
    const mock = createSupabaseMock({
      tables: { saved_conversations: { data: { ...ROW, messages: MESSAGES, analysis: null }, error: null } },
    });

    const saved = await getSavedConversation(mock as never, "u1", ROW.id);

    const b = mock.builderFor("saved_conversations");
    expect(b.eq).toHaveBeenCalledWith("id", ROW.id);
    expect(b.eq).toHaveBeenCalledWith("user_id", "u1");
    expect(b.maybeSingle).toHaveBeenCalled();
    expect(saved).toMatchObject({ id: ROW.id, messages: MESSAGES, analysis: null, overallScore: null });
  });

  it("returns null when the conversation is not the user's, and throws on errors", async () => {
    const missing = createSupabaseMock({ tables: { saved_conversations: { data: null, error: null } } });
    await expect(getSavedConversation(missing as never, "u1", ROW.id)).resolves.toBeNull();

    const broken = createSupabaseMock({ tables: { saved_conversations: { error: { message: "boom" } } } });
    await expect(getSavedConversation(broken as never, "u1", ROW.id)).rejects.toEqual({ message: "boom" });
  });

  it("upserts a transcript keyed by the call id and counts only learner turns", async () => {
    const mock = createSupabaseMock();

    await upsertSavedConversation(mock as never, "u1", ROW.id, {
      roleplayId: "r1",
      roleplayTitle: "Ordering coffee",
      tutorId: "luna",
      language: "spanish",
      level: "beginner",
      durationSeconds: 120,
      messages: MESSAGES,
      analysis: ANALYSIS,
    });

    const b = mock.builderFor("saved_conversations");
    expect(b.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: ROW.id,
        user_id: "u1",
        roleplay_title: "Ordering coffee",
        duration_seconds: 120,
        message_count: 1,
        messages: MESSAGES,
        analysis: ANALYSIS,
        updated_at: expect.any(String),
      }),
      { onConflict: "id" }
    );
  });

  it("leaves a stored analysis alone when re-saving without one", async () => {
    const mock = createSupabaseMock();

    await upsertSavedConversation(mock as never, "u1", ROW.id, {
      roleplayId: "r1",
      roleplayTitle: "Ordering coffee",
      tutorId: "luna",
      language: "spanish",
      level: "beginner",
      durationSeconds: 30,
      messages: MESSAGES,
    });

    expect(writePayload(mock, "saved_conversations", "upsert")).not.toHaveProperty("analysis");
  });

  it("throws when the upsert fails", async () => {
    const mock = createSupabaseMock({ tables: { saved_conversations: { error: { message: "rls" } } } });
    await expect(
      upsertSavedConversation(mock as never, "u1", ROW.id, {
        roleplayId: "r1",
        roleplayTitle: "t",
        tutorId: "luna",
        language: "spanish",
        level: "beginner",
        durationSeconds: 0,
        messages: [],
      })
    ).rejects.toEqual({ message: "rls" });
  });

  it("deletes one saved conversation, or all of them, only for the owner", async () => {
    const mock = createSupabaseMock();

    await deleteSavedConversation(mock as never, "u1", ROW.id);
    await deleteAllSavedConversations(mock as never, "u1");

    const one = mock.builderFor("saved_conversations", 0);
    expect(one.delete).toHaveBeenCalled();
    expect(one.eq).toHaveBeenCalledWith("id", ROW.id);
    expect(one.eq).toHaveBeenCalledWith("user_id", "u1");

    const all = mock.builderFor("saved_conversations", 1);
    expect(all.delete).toHaveBeenCalled();
    expect(all.eq).toHaveBeenCalledWith("user_id", "u1");
  });

  it("throws when a delete fails", async () => {
    const mock = createSupabaseMock({ tables: { saved_conversations: { error: { message: "nope" } } } });
    await expect(deleteSavedConversation(mock as never, "u1", ROW.id)).rejects.toEqual({ message: "nope" });
    await expect(deleteAllSavedConversations(mock as never, "u1")).rejects.toEqual({ message: "nope" });
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
