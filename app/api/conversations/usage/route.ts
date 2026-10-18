import { NextResponse } from "next/server";
import { requireUser } from "@/lib/require-user";
import { getProfileRow } from "@/lib/db/profile";
import { countConversations } from "@/lib/db/conversations";
import { hasProAccess, FREE_CONVERSATIONS } from "@/lib/billing";

export async function GET() {
  const { supabase, user, response } = await requireUser();
  if (!user) return response;

  const [row, freeUsed] = await Promise.all([getProfileRow(supabase, user.id), countConversations(supabase, user.id)]);

  const isPro = hasProAccess(row);
  const freeRemaining = isPro ? 999 : Math.max(0, FREE_CONVERSATIONS - freeUsed);

  return NextResponse.json({ isPro, freeLimit: FREE_CONVERSATIONS, freeUsed, freeRemaining });
}
