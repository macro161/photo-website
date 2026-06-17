import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    // Originals can be large; the generated web images are what ship.
    chunkSizeWarningLimit: 1500,
  },
})
