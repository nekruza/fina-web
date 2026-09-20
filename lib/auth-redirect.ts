/**
 * Returns the origin that should receive Supabase Auth callbacks.
 *
 * Production uses the configured public URL so OAuth never falls back to a
 * local development origin. Local development and preview deployments keep
 * using the current browser origin.
 */
export function getAuthOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL?.trim().replace(/\/$/, "");

  if (configuredOrigin && process.env.NODE_ENV === "production") {
    return configuredOrigin;
  }

  return typeof window !== "undefined" ? window.location.origin : configuredOrigin || "http://localhost:3000";
}
