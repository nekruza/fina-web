import { requireUser } from "@/lib/require-user";
import { requireActiveSession } from "@/lib/db/conversations";

export async function GET(req: Request) {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const sessionId = new URL(req.url).searchParams.get("sessionId");
  const session = await requireActiveSession(supabase, user.id, sessionId);
  if (!session.ok) {
    return Response.json({ error: session.error }, { status: 403 });
  }

  const apiKey = process.env.INWORLD_API_KEY;
  if (!apiKey) {
    return Response.json({ error: "INWORLD_API_KEY not configured" }, { status: 500 });
  }

  const iceRes = await fetch("https://api.inworld.ai/v1/realtime/ice-servers", {
    headers: {
      Authorization: `Basic ${apiKey}`,
    },
  });

  if (!iceRes.ok) {
    return Response.json(
      { error: `Failed to fetch ICE servers: ${iceRes.status}` },
      { status: 500 }
    );
  }

  const data = await iceRes.json() as { ice_servers?: RTCIceServer[]; iceServers?: RTCIceServer[] };
  const iceServers = data.ice_servers ?? data.iceServers ?? [];

  return Response.json({ iceServers });
}
