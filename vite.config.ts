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
    // Dedicated port for Methodical (5173 is the Call Change App). strictPort
    // means it fails loudly if 5181 is taken rather than silently moving elsewhere.
    port: 5181,
    strictPort: true,
  },
})
