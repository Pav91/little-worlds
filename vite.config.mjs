import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { createOpenAIObjectApiPlugin } from "./server/openaiObjectApi.mjs";

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
    }), react()],
  };
});
