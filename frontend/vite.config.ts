import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// /api is proxied to the Express backend, so phones on the same Wi-Fi only need the Vite URL.
export default defineConfig({
  plugins: [react()],
  server: { proxy: { "/api": "http://localhost:3001" } },
});
