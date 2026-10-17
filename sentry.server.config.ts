import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

Sentry.init({
  ...sentryOptions,
  // Route handlers catch provider failures (Gemini, OpenAI, Inworld, Stripe,
  // Supabase) and log them with console.error rather than rethrowing. Report
  // those too, so handled failures aren't only visible in Vercel logs.
  integrations: [Sentry.captureConsoleIntegration({ levels: ["error"] })],
});
