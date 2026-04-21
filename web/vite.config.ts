/// <reference types="vitest" />
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  server: {
    host: "127.0.0.1",
    port: 5173,
    // The hub (http://127.0.0.1:8080) is the user-facing URL and reverse-proxies
    // here for dev assets + HMR. Tell vite's HMR client to connect back through
    // the hub on its port so the proxied websocket finds vite.
    hmr: { clientPort: 8080 },
  },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    css: false,
  },
});
