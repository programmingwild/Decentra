import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  // Next.js sets tsconfig jsx:preserve — disable oxc (which would ignore
  // esbuild options) and force esbuild's automatic runtime so test JSX
  // transforms. The cast is needed: installed Vite types no longer declare
  // this key, but it is honored at runtime (verified by the suite).
  oxc: false,
  esbuild: { jsx: "automatic" } as any,
  test: {
    environment: "jsdom",
    setupFiles: ["./vitest.setup.ts"],
    include: ["**/*.{test,spec}.{ts,tsx}"],
    exclude: ["node_modules", ".next"],
  },
  resolve: {
    alias: { "@": path.resolve(__dirname, "./") },
  },
});
