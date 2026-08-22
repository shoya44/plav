import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"

export default defineConfig({
  plugins: [react()],

  // package.json の version と、ビルド日時（Settings > About表示用）を画面へ埋め込む。
  define: {
    "import.meta.env.VITE_APP_VERSION": JSON.stringify(
      process.env.npm_package_version ?? "dev",
    ),
    "import.meta.env.VITE_BUILD_DATE": JSON.stringify(
      new Date().toISOString(),
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
