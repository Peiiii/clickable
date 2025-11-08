import path from "path";
import { fileURLToPath } from "url";
import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, ".", "");
  // FIX: __dirname is not available in ES modules. This defines it using import.meta.url.
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  return {
    server: {
      port: 3000,
      host: "0.0.0.0",
    },
    plugins: [react()],
    define: {
      "process.env.AI_PROVIDER": JSON.stringify(env.AI_PROVIDER || "gemini"),
      "process.env.API_KEY": JSON.stringify(env.API_KEY || env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        "@": path.resolve(__dirname, "."),
      },
    },
  };
});
