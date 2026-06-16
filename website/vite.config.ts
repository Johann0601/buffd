import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'node:path'

// Die Seite liegt auf GitHub Pages unter https://johann0601.github.io/buffd/
// -> base muss '/buffd/' sein, damit JS/CSS-Pfade stimmen.
// Gebaut wird direkt in ../docs (von dort serviert GitHub Pages).
export default defineConfig({
  base: '/buffd/',
  plugins: [react()],
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') }
  },
  build: {
    outDir: '../docs',
    emptyOutDir: true
  }
})
