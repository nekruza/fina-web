import { requireUser } from "@/lib/require-user";
import { requireActiveSession } from "@/lib/db/conversations";

export async function POST(req: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "INWORLD_API_KEY not configured" }, { status: 500 });
  }

  const { sdp, sessionId } = await req.json() as { sdp: string; sessionId?: unknown };
  if (!sdp) {
    return Response.json({ error: "Missing SDP offer" }, { status: 400 });
  }

  const session = await requireActiveSession(supabase, user.id, sessionId);
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: 403 });
  }

  const sdpRes = await fetch("https://api.inworld.ai/v1/realtime/calls", {
    method: "POST",
    headers: {
      Authorization: `Basic ${apiKey}`,
      "Content-Type": "application/sdp",
    },
    body: sdp,
  });

  if (!sdpRes.ok) {
    const body = await sdpRes.text().catch(() => "");
    console.error("[realtime/connect] Inworld error:", sdpRes.status, body);
    return Response.json(
      { error: `SDP exchange failed: ${sdpRes.status}`, detail: body },
      { status: 500 }
    );
  }

  const answerSdp = await sdpRes.text();
  return new Response(answerSdp, {
    headers: { "Content-Type": "application/sdp" },
  });
}
