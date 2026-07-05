import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages at https://emma-london.github.io/MethodicalApp/
export default defineConfig({
  plugins: [react()],
  base: '/MethodicalApp/',
  optimizeDeps: {
    // Pre-bundle the whole library once at startup. Without this, importing a
    // new export from ringing-lib-ts mid-session makes Vite re-optimize and
    // force a full page reload (the "spinning wheel" on every change).
    include: ['ringing-lib-ts'],
  },
  server: {
    // Pin the port so there is ONE canonical dev URL (http://localhost:5173/MethodicalApp/).
    // Without this, if a previous dev server is still running Vite silently drifts
    // to 5174/5175, and the old (possibly wedged) server keeps answering the old
    // URL — which looks like a hang. strictPort makes a leftover server a clear
    // error ("Port 5173 is in use") instead, so you know to kill it.
    port: 5173,
    strictPort: true,
    watch: {
      // Wait for a file to finish writing before processing it — the Cowork sync
      // can write several files at once, and this avoids reading one mid-write.
      awaitWriteFinish: { stabilityThreshold: 300, pollInterval: 50 },
    },
  },
})
