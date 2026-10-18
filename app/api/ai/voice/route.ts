import { requireUser } from "@/lib/require-user";
import { streamLLM } from "@/lib/llm";
import { buildConversationInstructions, buildHintPrompt } from "@/lib/utils/buildConversationInstructions";
import { isLanguageId, type LanguageId } from "@/lib/languages";
import { isUserLevel, type UserLevel } from "@/lib/levels";
import { getTutorById } from "@/lib/tutors";
import { requireActiveSession } from "@/lib/db/conversations";

export const runtime = "nodejs";

interface ConversationMessage {
  role: string;
  content: string;
}

interface RoleplayBody {
  title: string;
  userRole: string;
  aiRole: string;
  scenario: string;
}

/**
 * Fina's fixed English hint fallback — ported verbatim from the "on error"
 * branch of `generateResponseHints` in fina's `services/geminiChatService.ts`.
 */
const FALLBACK_HINTS = [
  "Can you explain that in more detail?",
  "That's interesting! Can you give me an example?",
  "I understand. What else should I know?",
  "Thanks! How can I practice this?",
];

const BEGIN_RE = /^\[BEGIN\]/i;

/** Only the recent history is useful to the model; older turns just cost tokens. */
const MAX_MESSAGES = 40;
const MAX_CONTENT_CHARS = 4000;

/** Keeps the last 40 messages and truncates each to 4000 characters. Over the cap is trimmed, never rejected. */
function capMessages(messages: unknown[]): ConversationMessage[] {
  return messages.slice(-MAX_MESSAGES).map((m) => {
    const raw = (m ?? {}) as Record<string, unknown>;
    return {
      role: String(raw.role ?? ""),
      content: String(raw.content ?? "").slice(0, MAX_CONTENT_CHARS),
    };
  });
}

function jsonResponse(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function buildHintTranscript(messages: ConversationMessage[]): string {
  return messages
    .filter((m) => !(m.role === "user" && BEGIN_RE.test(m.content.trim())))
    .slice(-6)
    .map((m) => `${m.role === "user" ? "Learner" : "Tutor"}: ${m.content}`)
    .join("\n\n");
}

export async function POST(req: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const { messages: rawMessages, language, level, tutorId, roleplay, isHint, sessionId } = await req.json();

  if (!rawMessages || !Array.isArray(rawMessages)) {
    return jsonResponse({ error: "Missing required fields" }, 400);
  }

  const session = await requireActiveSession(supabase, user.id, sessionId);
  if (!session.ok) {
    return jsonResponse({ error: session.error }, 403);
  }

  const messages = capMessages(rawMessages);

  const resolvedLanguage: LanguageId = isLanguageId(language) ? language : "english";
  const resolvedLevel: UserLevel = isUserLevel(level) ? level : "beginner";
  const roleplayCtx: RoleplayBody | null = roleplay ?? null;

  const systemPrompt = isHint
    ? buildHintPrompt(resolvedLanguage)
    : buildConversationInstructions({
        language: resolvedLanguage,
        level: resolvedLevel,
        tutorName: getTutorById(tutorId).name,
        roleplay: roleplayCtx,
      });

  // ── Hint: plain JSON response, no streaming needed ──────────────────────────
  if (isHint) {
    try {
      let raw = "";
      for await (const chunk of streamLLM({
        systemPrompt,
        messages: [{ role: "user", content: buildHintTranscript(messages) }],
        maxTokens: 400,
        temperature: 0.8,
      })) {
        raw += chunk;
      }

      const stripped = raw
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```\s*$/, "")
        .trim();

      const parsed = JSON.parse(stripped);
      const hints: string[] = Array.isArray(parsed.hints)
        ? parsed.hints
            .map((h: unknown) => String(h).trim())
            .filter((h: string) => h.length > 0)
            .slice(0, 4)
        : [];

      return new Response(JSON.stringify({ hints: hints.length > 0 ? hints : FALLBACK_HINTS }), {
        headers: { "Content-Type": "application/json" },
      });
    } catch {
      return new Response(JSON.stringify({ hints: FALLBACK_HINTS }), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  // ── Conversation turn: SSE stream ────────────────────────────────────────────
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      try {
        for await (const chunk of streamLLM({
          systemPrompt,
          messages,
          maxTokens: 300,
          temperature: 0.7,
        })) {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify({ text: chunk })}\n\n`)
          );
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      } catch (err) {
        // Provider error text can carry request details, so it stays in the
        // server log and the client gets a generic message.
        console.error("[ai/voice] stream error:", err);
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ error: "AI service error" })}\n\n`)
        );
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  });
}
