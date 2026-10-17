import type { NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function middleware(req: NextRequest) {
  return updateSession(req);
}

export const config = {
  // `monitoring` is the Sentry tunnel route (next.config.ts). It needs no
  // session refresh, and running auth on every error report would be wasted work.
  matcher: [
    "/((?!monitoring|_next/static|_next/image|favicon.ico|icon.png|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp4)$).*)",
  ],
};
