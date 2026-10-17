import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

Sentry.init({
  ...sentryOptions,
  // Route handlers catch provider failures (Gemini, OpenAI, Inworld, Stripe,
  // Supabase) and log them with console.error rather than rethrowing. Report
  // those too, so handled failures aren't only visible in Vercel logs.
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
  // Node prints its own process warnings ("(node:1234) [DEP0060]
  // DeprecationWarning: ...") through console.error, so the integration above
  // would file one as an issue on every cold start. They aren't app errors.
  ignoreErrors: [/^\(node:\d+\) /],
});
