"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

/**
 * Last-resort boundary for errors thrown while rendering the root layout.
 * It replaces the whole document, so it can't rely on globals.css or the
 * layout's fonts — styles are inline, using the Fina palette.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          padding: "24px",
          background: "#F7F4EE",
          color: "#1B1A17",
          fontFamily: "system-ui, -apple-system, Segoe UI, sans-serif",
        }}
      >
        <main style={{ maxWidth: 420, textAlign: "center" }}>
          <h1 style={{ fontSize: 24, margin: "0 0 8px" }}>Something went wrong</h1>
          <p style={{ color: "#6E6A63", margin: "0 0 24px", lineHeight: 1.5 }}>
            We&apos;ve been notified and are looking into it. Please try again.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              background: "#2E5E3E",
              color: "#FFFFFF",
              border: 0,
              borderRadius: 999,
              padding: "12px 24px",
              fontSize: 16,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
