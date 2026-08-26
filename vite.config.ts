import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        // G23 — split big vendors into their own cacheable chunks so the entry
        // bundle isn't one ~1.3 MB blob. React's runtime (react/react-dom/
        // scheduler) + router are grouped TOGETHER on purpose — splitting React
        // across chunks risks duplicate-React identity bugs. Icons + Datadog are
        // leaf libs, safe to isolate. Route pages are already lazy (see App.tsx).
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('lucide-react')) return 'vendor-icons';
          if (id.includes('@datadog')) return 'vendor-datadog';
          // Charts (recharts + its d3 deps) — only the Dashboard/Analytics pages
          // import them, so keep them in a separate lazily-loaded chunk.
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'vendor-charts';
          if (
            id.includes('/react/') ||
            id.includes('/react-dom/') ||
            id.includes('/scheduler/') ||
            id.includes('react-router')
          ) {
            return 'vendor-react';
          }
          return 'vendor';
        },
      },
    },
  },
  server: {
    proxy: {
      '/api': {
        // [SHL-2-2] Defaults to LOCALHOST. This used to default to production, so `npm run dev`
        // on a fresh clone proxied writes to the live business. A wrong default that fails is
        // recoverable; a wrong default that works is not.
        target: process.env.VITE_API_PROXY || 'http://localhost:8080',
        changeOrigin: true,
        secure: true,
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq) => {
            proxyReq.removeHeader('origin');
            proxyReq.removeHeader('referer');
          });
        },
      },
    },
  },
})
