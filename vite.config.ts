import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Deployed to GitHub Pages at https://emma-london.github.io/MethodicalApp/
export default defineConfig({
  plugins: [react()],
  base: '/MethodicalApp/',
})
