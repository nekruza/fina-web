import * as Sentry from "@sentry/nextjs";
import { sentryOptions } from "./sentry.shared";

// Runs for middleware.ts.
Sentry.init(sentryOptions);
