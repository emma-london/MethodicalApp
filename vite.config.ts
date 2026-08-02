import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Deployed to GitHub Pages at https://emma-london.github.io/MethodicalApp/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      // autoUpdate: the new service worker installs in the background whenever
      // the user is online and takes over on the next launch — no reload prompt,
      // and it can never disrupt an offline session because it needs the network
      // to update. This preserves the ~2-minute Vite deploy pipeline: push, and
      // users pick up the new version the next time they open the app online.
      registerType: 'autoUpdate',
      // Inject the registration script into index.html for us; no code change
      // needed in main.tsx.
      injectRegister: 'auto',
      // The plugin now owns the manifest (previously public/manifest.webmanifest).
      manifest: {
        name: 'Methodical',
        short_name: 'Methodical',
        description: 'Look up and learn change ringing methods.',
        id: '/MethodicalApp/',
        start_url: '/MethodicalApp/',
        scope: '/MethodicalApp/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#1a1a2e',
        theme_color: '#1a1a2e',
        icons: [
          { src: '/MethodicalApp/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/MethodicalApp/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/MethodicalApp/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // Precache the whole app shell so it boots with the network unplugged.
        globPatterns: ['**/*.{js,css,html,svg,png,webmanifest}'],
        // SPA fallback: a refresh or deep link while offline still resolves to
        // the app shell rather than a failed navigation.
        navigateFallback: '/MethodicalApp/index.html',
        cleanupOutdatedCaches: true,
        // NOTE: when the full CCCBR library loader lands (see
        // docs/design/full-library-loader.md), add a runtimeCaching rule here so
        // methods fetched on demand are cached and persist offline too.
      },
    }),
  ],
  base: '/MethodicalApp/',
  optimizeDeps: {
    // Pre-bundle the whole library once at startup. Without this, importing a
    // new export from ringing-lib-ts mid-session makes Vite re-optimize and
    // force a full page reload (the "spinning wheel" on every change).
    include: ['ringing-lib-ts'],
  },
  server: {
    // Dedicated port for Methodical (5173 is the Call Change App). strictPort
    // means it fails loudly if 5181 is taken rather than silently moving elsewhere.
    port: 5181,
    strictPort: true,
  },
})
