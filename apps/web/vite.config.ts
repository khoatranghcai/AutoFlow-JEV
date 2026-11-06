import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to the local API (pnpm --filter @autoflow/api start) so the browser needs no CORS setup.
// `vite --mode live` (pnpm dev:live) turns on live mode without any environment variable syntax.
export default defineConfig(({ mode }) => ({
  plugins: [react()],
  define: mode === "live" ? { "import.meta.env.VITE_LIVE_API": JSON.stringify("1") } : {},
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", rewrite: (p) => p.replace(/^\/api/, "") } } },
}));
