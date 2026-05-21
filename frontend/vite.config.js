import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

const SERVER_PORT = 3000;

// The proxy makes browser requests to /api (from localhost:5173) appear as
// same-origin requests to the Express server on localhost:3000. The browser
// sends session cookies automatically, just like in production where the
// Express server serves the built frontend from the same origin.
export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],
  server: {
    proxy: {
      '/api': {
        target: `http://localhost:${SERVER_PORT}`,
        changeOrigin: true,
      },
    },
  },
});