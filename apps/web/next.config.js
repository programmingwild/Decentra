/** @type {import("next").NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  compress: true,
  // Same-origin API proxy: the browser only ever talks to the web origin,
  // so auth cookies stay first-party and no custom domain / CORS dance is
  // needed on cloud hosts. The target resolves at REQUEST time from server
  // env — set API_INTERNAL_URL on the host (e.g. Railway private network).
  async rewrites() {
    const api =
      process.env.API_INTERNAL_URL ||
      process.env.NEXT_PUBLIC_API_URL ||
      "http://localhost:8000";
    return [{ source: "/api/v1/:path*", destination: `${api}/api/v1/:path*` }];
  },
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
