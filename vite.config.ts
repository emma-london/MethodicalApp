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
    watch: {
      // Files here are written by the Cowork sync, often several at once. The
      // native macOS watcher can read a file mid-write or drop events in a
      // burst, wedging the dev server (the hang that a restart "fixes").
      // Polling + awaitWriteFinish detect changes reliably and only after each
      // file has finished writing, so edits are picked up without a restart.
      usePolling: true,
      interval: 250,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 50,
      },
    },
  },
})
