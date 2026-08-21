import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  // package.json の version を画面表示用に埋め込む。
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      process.env.npm_package_version ?? "dev",
    ),
  },

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
