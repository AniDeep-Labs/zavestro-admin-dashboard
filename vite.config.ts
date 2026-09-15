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
        // across chunks risks duplicate-React identity bugs. Icons are a leaf lib,
        // safe to isolate. Route pages are already lazy (see App.tsx).
        //
        // [SCA-44-5] Datadog deliberately has NO rule here. A named manual chunk gets a
        // <link rel="modulepreload"> in index.html whether or not anything imports it
        // statically, so pinning @datadog to `vendor-datadog` put 201 KB — the single
        // largest preloaded chunk, bigger than the app's own vendor bundle — ahead of the
        // first page chunk on every cold load. Without the rule it falls into the
        // dynamically-imported instrument-rum chunk and is fetched after first paint.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return undefined;
          // Left for rollup to place, which means "wherever its importer is" — and its
          // only importer is the dynamic instrument-rum. Naming it would preload it; the
          // catch-all `vendor` below would fold it into a chunk that IS preloaded.
          if (id.includes('@datadog')) return undefined;
          if (id.includes('lucide-react')) return 'vendor-icons';
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
