// TTS proxy — primary: Inworld TTS 1.5 Mini, fallback: Chutes AI Kokoro.
// Returns 503 on failure so the client can fall back to Web SpeechSynthesis.

import { requireUser } from "@/lib/require-user";
import { isLanguageId, pronunciationVoice } from "@/lib/languages";

export const runtime = "nodejs";

const MAX_TEXT_LENGTH = 600;

export async function POST(req: Request) {
  // Synthesis is billed per request, so signed-in users only. Every caller
  // (pronunciation playback, the tutor voice fallback) lives inside /app.
  const { user, response } = await requireUser();
  if (!user) return response;

  let text: string;
  let voiceId: string | undefined;
  let language: string | undefined;
  try {
    const body = await req.json();
    text = body.text;
    voiceId = typeof body.voiceId === "string" ? body.voiceId : undefined;
    language = typeof body.language === "string" ? body.language : undefined;
  } catch {
    return new Response(JSON.stringify({ error: "Invalid request body" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!text?.trim()) {
    return new Response(JSON.stringify({ error: "Missing text" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (text.length > MAX_TEXT_LENGTH) {
    return new Response(JSON.stringify({ error: "Text too long" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Prefer an explicit voiceId; otherwise fall back to the target language's
  // pronunciation voice when one is given.
  const languageVoiceId =
    !voiceId && language && isLanguageId(language) ? pronunciationVoice(language) : undefined;

  // ── Primary: Inworld TTS 1.5 Mini ──────────────────────────────────────────
  const inworldKey = process.env.INWORLD_API_KEY;
  if (inworldKey) {
    try {
      const inworldRes = await fetch("https://api.inworld.ai/tts/v1/voice", {
        method: "POST",
        headers: {
          Authorization: `Basic ${inworldKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text,
          voiceId: voiceId ?? languageVoiceId ?? process.env.INWORLD_VOICE_ID ?? "Jason",
          modelId: "inworld-tts-1.5-mini",
        }),
      });

      if (inworldRes.ok) {
        const json = await inworldRes.json();
        if (json.audioContent) {
          const audio = Buffer.from(json.audioContent, "base64");
          return new Response(audio, {
            status: 200,
            headers: {
              "Content-Type": "audio/mpeg",
              "Cache-Control": "no-store",
            },
          });
        }
      }
    } catch {
      // Inworld failed — fall through to Chutes Kokoro
    }
  }

  // ── Fallback: Chutes AI Kokoro ──────────────────────────────────────────────
  const chutesKey = process.env.CHUTES_API_KEY;
  if (!chutesKey) {
    return new Response(null, { status: 503 });
  }

  try {
    const kokoroRes = await fetch("https://chutes-kokoro.chutes.ai/speak", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chutesKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ text }),
    });

    if (!kokoroRes.ok || !kokoroRes.body) {
      return new Response(null, { status: 503 });
    }

    const contentType = kokoroRes.headers.get("Content-Type") ?? "audio/mpeg";
    return new Response(kokoroRes.body, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Cache-Control": "no-store",
      },
    });
  } catch {
    return new Response(null, { status: 503 });
  }
}
