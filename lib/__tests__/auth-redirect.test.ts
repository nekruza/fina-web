import { getAuthOrigin } from "@/lib/auth-redirect";

// Mutate process.env in place (rather than replacing it) so `env` stays live.
const env = process.env as Record<string, string | undefined>;
const ORIGINAL = { NODE_ENV: env.NODE_ENV, NEXT_PUBLIC_APP_URL: env.NEXT_PUBLIC_APP_URL };

afterEach(() => {
  for (const [key, value] of Object.entries(ORIGINAL)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  delete (globalThis as { window?: unknown }).window;
});

function setBrowserOrigin(origin: string) {
  (globalThis as { window?: unknown }).window = { location: { origin } };
}

describe("getAuthOrigin", () => {
  it("uses the configured public URL in production, without a trailing slash", () => {
    env.NODE_ENV = "production";
    env.NEXT_PUBLIC_APP_URL = " https://fina.example.com/ ";
    setBrowserOrigin("http://localhost:3000");

    expect(getAuthOrigin()).toBe("https://fina.example.com");
  });

  it("uses the browser origin outside production", () => {
    env.NODE_ENV = "development";
    env.NEXT_PUBLIC_APP_URL = "https://fina.example.com";
    setBrowserOrigin("http://localhost:4000");

    expect(getAuthOrigin()).toBe("http://localhost:4000");
  });

  it("uses the browser origin in production when no public URL is configured", () => {
    env.NODE_ENV = "production";
    delete env.NEXT_PUBLIC_APP_URL;
    setBrowserOrigin("https://preview.example.com");

    expect(getAuthOrigin()).toBe("https://preview.example.com");
  });

  it("falls back to the configured URL on the server outside production", () => {
    env.NODE_ENV = "development";
    env.NEXT_PUBLIC_APP_URL = "https://fina.example.com";

    expect(getAuthOrigin()).toBe("https://fina.example.com");
  });

  it("falls back to localhost on the server when nothing is configured", () => {
    env.NODE_ENV = "development";
    delete env.NEXT_PUBLIC_APP_URL;

    expect(getAuthOrigin()).toBe("http://localhost:3000");
  });
});
