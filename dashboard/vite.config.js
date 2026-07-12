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
      // MinIO object storage — serves snapshot/recording images (the stream
      // bucket is public-read on the snapshots/recordings prefixes). Mirrors
      // the Aeroponik-Docker nginx `/storage/` → minio:9000 proxy.
      // /storage/{bucket}/{key}  ->  minio:9000/{bucket}/{key}
      '/storage': {
        target: 'http://minio:9000',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/storage/, ''),
      },
      // Mirrors the Aeroponik-Docker nginx `/live/` → mediamtx:8888 proxy.
      // /live/{name}/  ->  mediamtx:8888/{name}/
      //
      // MediaMTX v1.18+ performs an HLS cookie/session check that answers the
      // first manifest request with a 302 whose `Location` is ROOT-relative
      // (e.g. `/cctv-1/index.m3u8?cookieCheck=1`), dropping the `/live` prefix.
      // Without rewriting it, the browser follows the redirect to
      // `localhost:5173/cctv-1/...` (not proxied) and hls.js fails with
      // "EXTM3U delimiter error". We re-add the `/live` prefix to every
      // relative Location, exactly like nginx `proxy_redirect / /live/`.
      '/live': {
        target: 'http://mediamtx:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/live/, ''),
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            const loc = proxyRes.headers['location'] || proxyRes.headers['Location'];
            if (loc && typeof loc === 'string' && loc.startsWith('/')) {
              proxyRes.headers['location'] = '/live' + loc;
            }
          });
        },
      },
    },
  },
})
