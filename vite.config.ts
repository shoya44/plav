import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  // Local UI development uses the deployed Worker API.
  // Production requests /api on the same origin.
  server: {
    proxy: {
      "/api": {
        target: "https://plav.take503503.workers.dev",
        changeOrigin: true,
      },
    },
  },
})
