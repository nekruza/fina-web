/**
 * Sentry options shared by the browser, Node.js and edge runtimes.
 *
 * Sentry only reports from production builds that have a DSN, so `next dev`,
 * Jest, Playwright and CI never send events. Set NEXT_PUBLIC_SENTRY_DSN in
 * Vercel to turn it on; Preview and Production deployments are told apart by
 * NEXT_PUBLIC_VERCEL_ENV, which Vercel exposes automatically.
 */
const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

export const sentryOptions = {
  dsn,
  enabled: process.env.NODE_ENV === "production" && Boolean(dsn),
  environment: process.env.NEXT_PUBLIC_VERCEL_ENV ?? process.env.NODE_ENV,
  // Errors are always captured; only 10% of requests are traced.
  tracesSampleRate: 0.1,
  // Learners' conversations are personal. Don't attach IPs, cookies or headers.
  sendDefaultPii: false,
};
