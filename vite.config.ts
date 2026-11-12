import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Expose every .env value (not just VITE_*) to server code via process.env,
  // without overriding variables already set in the real environment.
  for (const [k, v] of Object.entries(
    loadEnv(mode, fileURLToPath(new URL(".", import.meta.url)), ""),
  )) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  // The Android app has no server of its own: it must know where the hosted one is.
  if (mode === "mobile" && !/^https:\/\//.test(process.env.VITE_API_BASE_URL ?? "")) {
    throw new Error(
      "Mobile build needs VITE_API_BASE_URL (https://…) — copy .env.mobile.example to .env.mobile and set it.",
    );
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        // Mobile (Capacitor) build: emit a static index.html shell so the app is
        // bundled into the APK and runs from local files. Server functions are
        // called on the hosted server via VITE_API_BASE_URL (see src/start.ts).
        ...(mode === "mobile"
          ? { spa: { enabled: true, prerender: { outputPath: "/index.html", crawlLinks: false } } }
          : {}),
        // Keep server-only modules out of the browser bundle.
        importProtection: {
          behavior: "error",
          // Keep TanStack's default "**/*.server.*" rule; listing files replaces it.
          client: { files: ["**/*.server.*", "**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Self-hosted Node server: `npm run build` then `npm start`.
      nitro({ preset: "node-server" }),
      viteReact(),
    ],
  };
});
