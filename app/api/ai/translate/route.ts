import { NextRequest, NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { streamLLM } from "@/lib/llm";
import { getLanguage, isLanguageId, type LanguageId } from "@/lib/languages";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const { user, response } = await requireUser();
  if (!user) return response;

  const { text, targetLanguage } = await req.json();

  if (typeof text !== "string" || text.length < 1 || text.length > 1000) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const resolvedLanguage: LanguageId = isLanguageId(targetLanguage) ? targetLanguage : "english";
  const label = getLanguage(resolvedLanguage).label;

  try {
    let translation = "";
    for await (const chunk of streamLLM({
      systemPrompt: `You are a translator. Translate the user's text into ${label}. Reply with the translation only, no quotes or notes.`,
      messages: [{ role: "user", content: text }],
      maxTokens: 400,
      temperature: 0.3,
    })) {
      translation += chunk;
    }

    return NextResponse.json({ translation: translation.trim() });
  } catch {
    return NextResponse.json({ error: "Translation failed" }, { status: 500 });
  }
}
