// @lovable.dev/vite-tanstack-config already includes the following — do NOT add them manually
// or the app will break with duplicate plugins:
//   - TanStack devtools (dev-only, first), tanstackStart, viteReact, tailwindcss, tsConfigPaths,
//     nitro (build-only using cloudflare as a default target), VITE_* env injection, @ path alias,
//     React/TanStack dedupe, error logger plugins, and sandbox detection (port/host/strictPort).
// Never set ssr.external or resolve.external: the Worker has no runtime module resolution, so
// the build fails. Never add compression (compressPublicAssets, vite-plugin-compression):
// hosting already compresses at the edge.
// You can pass additional config via defineConfig({ vite: { ... }, etc... }) if needed.
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  vite: {
    optimizeDeps: {
      include: [
        "@radix-ui/react-dialog",
        "@radix-ui/react-dropdown-menu",
        "@radix-ui/react-label",
        "@radix-ui/react-popover",
        "@radix-ui/react-slot",
        "@tanstack/react-query",
        "class-variance-authority",
        "clsx",
        "firebase/app",
        "firebase/auth",
        "firebase/firestore",
        "lucide-react",
        "sonner",
        "tailwind-merge",
      ],
    },
    server: {
      host: "0.0.0.0",
      port: 3000,
      strictPort: true,
      allowedHosts: true,
      warmup: {
        clientFiles: [
          "./src/router.tsx",
          "./src/routes/__root.tsx",
          "./src/routes/index.tsx",
          "./src/routes/about.tsx",
          "./src/routes/community.tsx",
          "./src/routes/events.tsx",
          "./src/routes/rules.tsx",
          "./src/routes/login.tsx",
          "./src/routes/discord.callback.tsx",
          "./src/routes/_authenticated/route.tsx",
          "./src/routes/_authenticated/dashboard/route.tsx",
          "./src/routes/_authenticated/dashboard/index.tsx",
          "./src/routes/_authenticated/dashboard/profile.tsx",
          "./src/routes/_authenticated/dashboard/rules.tsx",
          "./src/routes/_authenticated/dashboard/vip.tsx",
          "./src/routes/_authenticated/dashboard/applications.tsx",
          "./src/routes/_authenticated/dashboard/game.tsx",
          "./src/routes/_authenticated/dashboard/top-up.tsx",
          "./src/routes/_authenticated/dashboard/cash-top-up.tsx",
          "./src/routes/_authenticated/dashboard/events.tsx",
          "./src/routes/_authenticated/dashboard/settings.tsx",
          "./src/routes/_authenticated/dashboard/support.tsx",
        ],
      },
    },
  },
  nitro: {
    preset: "node-server",
  },
  tanstackStart: {
    // Redirect TanStack Start's bundled server entry to src/server.ts (our SSR error wrapper).
    // nitro/vite builds from this
    server: { entry: "server" },
  },
});
