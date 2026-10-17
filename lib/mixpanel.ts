type Mixpanel = (typeof import("mixpanel-browser"))["default"];

let initialized = false;
let client: Mixpanel | null = null;
// Calls made after initMixpanel() but before the SDK finishes loading.
const pending: Array<(mp: Mixpanel) => void> = [];

function whenIdle(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      window.requestIdleCallback(() => resolve(), { timeout: 3000 });
    } else {
      setTimeout(resolve, 1);
    }
  });
}

/**
 * mixpanel-browser bundles the rrweb session recorder (~110 KB gzipped), so
 * it is loaded once the page is idle instead of shipping in every page's
 * first-load JS. Calls made while it loads are queued and replayed in order.
 */
export function initMixpanel(): Promise<void> {
  if (initialized) return Promise.resolve();
  const token = process.env.NEXT_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return Promise.resolve();
  initialized = true;
  return whenIdle()
    .then(() => import("mixpanel-browser"))
    .then(({ default: mixpanel }) => {
      mixpanel.init(token, {
        autocapture: true,
        record_sessions_percent: 100,
        api_host: "https://api-eu.mixpanel.com",
      });
      client = mixpanel;
      for (const call of pending.splice(0)) call(mixpanel);
    });
}

function withMixpanel(call: (mp: Mixpanel) => void) {
  if (typeof window === "undefined") return;
  if (!initialized) return;
  if (client) call(client);
  else pending.push(call);
}

export function track(event: string, properties?: Record<string, unknown>) {
  withMixpanel((mp) => mp.track(event, properties));
}

export function identify(userId: string, email: string) {
  withMixpanel((mp) => {
    mp.identify(userId);
    mp.people.set({ $email: email });
  });
}

/**
 * Call once at signup to permanently link the anonymous device ID
 * to the authenticated user ID. Must be called BEFORE identify().
 */
export function aliasUser(userId: string) {
  withMixpanel((mp) => {
    try {
      mp.alias(userId);
    } catch {
      // alias throws if called more than once for the same user; swallow silently
    }
  });
}

export function resetMixpanel() {
  withMixpanel((mp) => mp.reset());
}
