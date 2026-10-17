import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs/config";

const nextConfig: NextConfig = {
  // Compress responses for faster TTFB
  compress: true,

  // Security and performance headers
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // Security headers
          {
            key: "X-Content-Type-Options",
            value: "nosniff",
          },
          {
            key: "X-Frame-Options",
            value: "DENY",
          },
          {
            key: "X-XSS-Protection",
            value: "1; mode=block",
          },
          {
            key: "Referrer-Policy",
            value: "strict-origin-when-cross-origin",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(self), microphone=(self), geolocation=()",
          },
        ],
      },
      // Cache static assets aggressively for Core Web Vitals
      {
        source: "/(.*)\\.(jpg|jpeg|png|gif|ico|svg|webp|avif|woff|woff2|ttf|eot)",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=31536000, immutable",
          },
        ],
      },
      // Cache video assets
      {
        source: "/(.*)\\.mp4",
        headers: [
          {
            key: "Cache-Control",
            value: "public, max-age=86400, stale-while-revalidate=3600",
          },
        ],
      },
    ];
  },

  // Optimize images for Core Web Vitals (LCP)
  images: {
    formats: ["image/avif", "image/webp"],
    minimumCacheTTL: 86400,
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "qynzytaqbsthioybscsg.supabase.co",
        pathname: "/storage/v1/object/public/**",
      },
      {
        protocol: "https",
        hostname: "lh3.googleusercontent.com",
      },
    ],
  },

  // experimental.optimizeCss disabled — causes tailwindcss resolution error from parent dir
  // experimental: { optimizeCss: true },
};

export default withSentryConfig(nextConfig, {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  // Build-time only: uploads source maps so production stack traces are readable.
  authToken: process.env.SENTRY_AUTH_TOKEN,
  // Without a token (local builds, CI, forks) skip the upload instead of warning.
  sourcemaps: { disable: !process.env.SENTRY_AUTH_TOKEN },
  widenClientFileUpload: true,
  // Send browser events through our own origin so ad blockers don't drop them.
  // Excluded from the auth middleware matcher in middleware.ts.
  tunnelRoute: "/monitoring",
  // Strip the SDK's internal logger from the browser bundle.
  bundleSizeOptimizations: { excludeDebugStatements: true },
  silent: !process.env.CI,
});
