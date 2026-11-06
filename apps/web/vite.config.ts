import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to the local API (pnpm --filter @autoflow/api start) so the browser needs no CORS setup.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": { target: "http://127.0.0.1:8787", rewrite: (p) => p.replace(/^\/api/, "") } } },
});
