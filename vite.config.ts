import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import { nitro } from "nitro/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(({ mode }) => {
  // Expose every .env value (not just VITE_*) to server code via process.env,
  // without overriding variables already set in the real environment.
  for (const [k, v] of Object.entries(loadEnv(mode, process.cwd(), ""))) {
    if (process.env[k] === undefined) process.env[k] = v;
  }

  return {
    server: {
      host: "::",
      port: 8080,
    },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
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
        // Keep server-only modules out of the browser bundle.
        importProtection: {
          behavior: "error",
          client: { files: ["**/server/**"], specifiers: ["server-only"] },
        },
      }),
      // Self-hosted Node server: `npm run build` then `npm start`.
      nitro({ preset: "node-server" }),
      viteReact(),
    ],
  };
});
