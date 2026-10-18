import type { User } from "@supabase/supabase-js";
import { requireUser } from "@/lib/require-user";

/**
 * Admins are listed by email in `ADMIN_EMAILS` (comma-separated, server-only).
 * Unset means nobody is an admin, so the admin pages and API stay closed by
 * default. Comparison is case-insensitive; the email must be the one on the
 * Supabase auth user.
 */
export function isAdminEmail(email: string | null | undefined, env: NodeJS.ProcessEnv = process.env): boolean {
  if (!email) return false;
  const admins = (env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return admins.includes(email.trim().toLowerCase());
}

type RequireAdminResult = { user: User; response?: undefined } | { user: null; response: Response };

/**
 * `requireUser` plus the admin check, for admin API routes. Non-admins get a
 * 404 rather than a 403 so the routes don't advertise that they exist.
 *
 *   const { user, response } = await requireAdmin();
 *   if (!user) return response;
 */
export async function requireAdmin(): Promise<RequireAdminResult> {
  const { user, response } = await requireUser();
  if (!user) return { user: null, response };
  if (!isAdminEmail(user.email)) {
    return { user: null, response: Response.json({ error: "Not found" }, { status: 404 }) };
  }
  return { user };
}
