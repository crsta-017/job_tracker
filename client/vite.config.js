import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Proxies /api to the Express server, so no CORS or URL config is needed in dev
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:5000" } },
});
