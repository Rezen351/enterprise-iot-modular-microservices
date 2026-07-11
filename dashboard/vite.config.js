import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// The dashboard talks to the backend through the Kong API Gateway.
// By default the API client calls Kong directly (VITE_API_URL, default
// http://localhost:8000) and relies on Kong's CORS plugin. The proxy below
// is an optional dev fallback if you prefer same-origin requests.
const KONG_URL = process.env.VITE_API_URL || 'http://localhost:8000'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    allowedHosts: true,
    proxy: {
      '/auth': { target: KONG_URL, changeOrigin: true },
      '/health': { target: KONG_URL, changeOrigin: true },
    },
  },
})
