import { rm } from 'node:fs/promises'
import path from 'node:path'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * public/generated/ exists so `npm run dev` can serve photos off your own
 * machine. In production those images are served from Cloudflare R2 instead
 * (see src/imageUrl.js), so copying them into dist/ would upload ~150 MB of
 * duplicates to Pages on every deploy. Drop them from the build output.
 */
function excludeGeneratedImages() {
  return {
    name: 'exclude-generated-images',
    apply: 'build',
    async closeBundle() {
      await rm(path.resolve(__dirname, 'dist/generated'), {
        recursive: true,
        force: true,
      })
    },
  }
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react(), excludeGeneratedImages()],
  build: {
    // Originals can be large; the generated web images are what ship.
    chunkSizeWarningLimit: 1500,
  },
})
