import { NextRequest, NextResponse } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { safeNext } from "@/lib/safe-next";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  const next = safeNext(searchParams.get("next"));
  const failureUrl = new URL("/login", origin);
  failureUrl.searchParams.set("error", "auth_callback_failed");
  failureUrl.searchParams.set("next", next);
  const response = NextResponse.redirect(`${origin}${next}`);

  try {
    if (!code) {
      response.headers.set("location", failureUrl.toString());
      return response;
    }
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      return response;
    }

    // Never log the callback URL, authorization code, cookies, or tokens.
    console.error("[auth/callback] Code exchange failed " + JSON.stringify({
      name: error?.name ?? "MissingUser",
      code: error?.code ?? "unknown",
      status: error?.status ?? null,
    }));
  } catch {
    console.error("[auth/callback] Code exchange threw an unexpected error");
  }

  // Keep cookie changes (including verifier cleanup) on failure as well as
  // success, and preserve the destination for a fresh sign-in attempt.
  response.headers.set("location", failureUrl.toString());
  return response;
}
