import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { cloudflare } from "@cloudflare/vite-plugin";
import { createOpenAIObjectApiPlugin } from "./server/openaiObjectApi.mjs";
import { sites } from "./build/sites-vite-plugin.mjs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  return {
    optimizeDeps: {
      include: ["react", "react-dom/client"],
    },
    server: {
      host: "0.0.0.0",
      allowedHosts: ["terminal.local"],
      warmup: {
        clientFiles: ["./src/main.jsx"],
      },
    },
    plugins: [createOpenAIObjectApiPlugin({
      apiKey: env.OPENAI_API_KEY,
      model: env.OPENAI_OBJECT_MODEL || "gpt-5.6-sol",
      serviceTier: env.OPENAI_OBJECT_SERVICE_TIER || "auto",
    }), react(), sites(), cloudflare({
      config: {
        main: "./worker/index.mjs",
        compatibility_date: "2026-07-21",
        compatibility_flags: ["nodejs_compat"],
        assets: {
          binding: "ASSETS",
          not_found_handling: "single-page-application",
          run_worker_first: ["/api/*"],
        },
      },
    })],
  };
});
