/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // NOTE: /api/v1/* proxying is a runtime route handler
  // (app/api/v1/[...path]/route.ts), NOT a static rewrite — rewrites() is
  // frozen at build time and can't see per-host API_INTERNAL_URL values.
}

// Sentry is a no-op without NEXT_PUBLIC_SENTRY_DSN (see sentry.*.config.ts).
let withSentry = (c) => c;
try {
  withSentry = require("@sentry/nextjs").withSentryConfig;
} catch {}

module.exports = withSentry(nextConfig, {
  silent: true,
  widenClientFileUpload: false,
  hideSourceMaps: true,
  disableLogger: true,
})
