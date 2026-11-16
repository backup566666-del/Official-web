import { defineConfig } from "@lovable.dev/vite-tanstack-config";

/**
 * Static SPA build configuration for Google Firebase Hosting (free Spark plan).
 * Uses nitro: false + TanStack Start SPA mode so `dist/client/index.html` is emitted
 * without requiring Node SSR or Cloud Run.
 */
export default defineConfig({
  nitro: false,
  tanstackStart: {
    server: { entry: "server" },
    spa: {
      enabled: true,
      prerender: {
        outputPath: "/index.html",
      },
    },
  },
});
