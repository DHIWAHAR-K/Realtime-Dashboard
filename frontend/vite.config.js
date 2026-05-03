import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Keep Vite configuration intentionally small for this single-page dashboard.
export default defineConfig({
  plugins: [react()],
})
