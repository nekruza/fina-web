import { test as base, expect, type Page, type Route } from "@playwright/test";
import {
  analysisFixture,
  hintsFixture,
  lessonFixture,
  profileFixture,
  usageFixture,
} from "../fixtures/data";

type Body = unknown;

/**
 * Per-test control over the app's own API surface.
 *
 * Everything the browser asks `/api/*` for is stubbed here rather than in the
 * Supabase stub, because Playwright routes are scoped to a single page — two
 * tests can hold contradictory states at the same time without interfering.
 */
export interface ApiMock {
  /** Replace the JSON response for an endpoint. Later calls win. */
  json(urlGlob: string, body: Body, status?: number): Promise<void>;
  /** Fail an endpoint with a status and body. */
  fail(urlGlob: string, status: number, body?: Body): Promise<void>;
  /** Serve a server-sent-event stream, as the AI voice route does for a conversation turn. */
  sse(urlGlob: string, chunks: string[]): Promise<void>;
  /**
   * Rows for a direct browser-to-Supabase table read.
   *
   * Several pages query Postgrest from the client rather than going through
   * `/api/*` — custom roleplays, favorites, lesson progress, generated
   * lessons, and the feedback form all do. Those requests are ordinary
   * browser fetches, so they can be stubbed per test.
   */
  table(name: string, rows: Record<string, unknown>[]): Promise<void>;
  /** Every request the page made to a matching URL. */
  calls(urlSubstring: string): Array<{ method: string; url: string; body: string | null }>;
}

function jsonRoute(route: Route, body: Body, status = 200) {
  return route.fulfill({
    status,
    contentType: "application/json",
    body: JSON.stringify(body),
  });
}

export const test = base.extend<{ api: ApiMock }>({
  // `auto: true` so every test gets the external-host blocker and the
  // default `/api/*` mocks even when it never destructures `api` itself —
  // otherwise a test that forgets to ask for it would fall through to the
  // real handlers (real AI/TTS/Stripe calls), silently breaking hermeticity.
  api: [async ({ page, context }, use) => {
    const recorded: Array<{ method: string; url: string; body: string | null }> = [];

    page.on("request", (req) => {
      if (req.url().includes("/api/")) {
        recorded.push({
          method: req.method(),
          url: req.url(),
          body: req.postData(),
        });
      }
    });

    // Keep the run hermetic: no request may leave the machine.
    //
    // Matched by origin, never by substring. Matching on vendor names in the URL
    // is a trap here — the app bundles `mixpanel-browser`, so its own chunk is
    // served from a path containing "mixpanel". Stubbing that out empties a
    // module the page depends on, and the route renders but never initialises:
    // no effects, no data fetching, and no error to explain it.
    //
    // Third-party scripts are answered with an empty *executable* body rather
    // than a 204 or an abort, because a browser treats those as a script load
    // failure. An empty 200 loads cleanly and defines nothing, so `gtag` stays
    // undefined and the app takes its documented no-analytics path.
    // Matched with a predicate rather than "**/*" so local traffic is never
    // handed to a handler at all. Routing every static chunk through the test
    // driver costs a round trip each and, under parallel workers, is enough to
    // push a heavy page past its timeout.
    const isExternal = (url: URL) =>
      url.hostname !== "localhost" && url.hostname !== "127.0.0.1";

    await context.route(isExternal, (route) =>
      route.fulfill({
        status: 200,
        contentType: "application/javascript",
        body: "",
      })
    );

    // ── Defaults ─────────────────────────────────────────────────────────────
    // Enough for any page to render. Individual tests override what they assert.
    await page.route("**/api/profile", (r) =>
      r.request().method() === "PATCH" ? jsonRoute(r, { ok: true }) : jsonRoute(r, profileFixture())
    );
    // Saved transcripts. Registered before `/usage` because Playwright tries the
    // most recently registered route first, so `/usage` keeps its own mock.
    await page.route("**/api/conversations/*", (r) => {
      const method = r.request().method();
      if (method === "GET") return jsonRoute(r, { error: "Not found" }, 404);
      return jsonRoute(r, { ok: true });
    });
    await page.route("**/api/conversations/usage", (r) => jsonRoute(r, usageFixture(3, false)));
    await page.route("**/api/conversations", (r) => {
      const method = r.request().method();
      if (method === "POST") return jsonRoute(r, { sessionId: "e2e-conv-1" });
      if (method === "PATCH")
        return jsonRoute(r, {
          ok: true,
          streak: { current: 3, weeklyActivity: [false, true, true, true, false, false, false], lastConversationDate: "2026-09-13" },
        });
      return jsonRoute(r, { sessions: [] });
    });
    await page.route("**/api/ai/feedback", (r) => jsonRoute(r, analysisFixture()));
    await page.route("**/api/ai/voice", (r) => {
      const body = r.request().postDataJSON() as { isHint?: boolean } | null;
      if (body?.isHint) return jsonRoute(r, { hints: hintsFixture });
      return r.fulfill({
        status: 200,
        headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache" },
        body: `data: ${JSON.stringify({ text: "¡Hola! Bienvenido, ¿qué te gustaría pedir hoy?" })}\n\ndata: [DONE]\n\n`,
      });
    });
    await page.route("**/api/tts", (r) => r.fulfill({ status: 503, body: "" }));
    await page.route("**/api/realtime/config", (r) => jsonRoute(r, { iceServers: [] }));
    await page.route("**/api/ai/translate", (r) => jsonRoute(r, { translation: "Hello" }));

    const api: ApiMock = {
      async json(urlGlob, body, status = 200) {
        await page.route(urlGlob, (r) => jsonRoute(r, body, status));
      },
      async fail(urlGlob, status, body = { error: "e2e-failure" }) {
        await page.route(urlGlob, (r) => jsonRoute(r, body, status));
      },
      async sse(urlGlob, chunks) {
        await page.route(urlGlob, (r) =>
          r.fulfill({
            status: 200,
            headers: {
              "Content-Type": "text/event-stream",
              "Cache-Control": "no-cache",
            },
            body:
              chunks
                .map((c) => `data: ${JSON.stringify({ text: c })}\n\n`)
                .join("") + "data: [DONE]\n\n",
          })
        );
      },
      async table(name, rows) {
        await page.route(`**/rest/v1/${name}**`, (r) => {
          // `.single()` asks for one object rather than an array via Accept.
          const wantsOne = (r.request().headers()["accept"] ?? "").includes(
            "vnd.pgrst.object+json"
          );
          if (r.request().method() !== "GET") return jsonRoute(r, rows, 201);
          return jsonRoute(r, wantsOne ? (rows[0] ?? null) : rows);
        });
      },
      calls(urlSubstring) {
        return recorded.filter((r) => r.url.includes(urlSubstring));
      },
    };

    await use(api);
  }, { auto: true }],
});

/**
 * Fail a test on any uncaught page error — a silent crash is still a bug.
 *
 * One exception is tolerated. Ending a conversation while the WebRTC
 * offer/answer exchange is still in flight rejects with "setRemoteDescription
 * ... signalingState is 'closed'", because the peer connection is torn down
 * before the answer arrives. It is a real unhandled rejection in the app, but
 * it is a teardown race rather than a fault this suite introduces, and
 * stubbing makes the handshake finish fast enough to hit it far more often
 * than a real session would. Tracked separately; ignored here so it cannot
 * mask other crashes.
 */
const KNOWN_TEARDOWN_RACE = /setRemoteDescription.*signalingState is 'closed'/;

test.beforeEach(async ({ page }) => {
  page.on("pageerror", (err) => {
    if (KNOWN_TEARDOWN_RACE.test(err.message)) return;
    throw new Error(`Uncaught page error: ${err.message}`);
  });
});

export { expect, analysisFixture, hintsFixture, lessonFixture, profileFixture, usageFixture };
export type { Page };
