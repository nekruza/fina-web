import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

type ServerClient = Awaited<ReturnType<typeof createClient>>;

type RequireUserResult =
  | { supabase: ServerClient; user: User; response?: undefined }
  | { supabase: ServerClient; user: null; response: Response };

/**
 * Shared auth guard for API routes. Destructure and return early:
 *
 *   const { supabase, user, response } = await requireUser();
 *   if (!user) return response;
 */
export async function requireUser(): Promise<RequireUserResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { supabase, user: null, response: Response.json({ error: "Unauthorized" }, { status: 401 }) };
  }
  return { supabase, user };
}
