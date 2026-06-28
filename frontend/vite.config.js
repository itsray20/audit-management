import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// The VITE_API_URL environment variable is set in Vercel to point to the Render backend.
// In local development, the proxy below forwards /api to localhost:5000.
const PROD_API_URL = process.env.VITE_API_URL || '';

export default defineConfig({
  plugins: [react()],
  server: {
    host: true, // Bind to 0.0.0.0 so mobile devices on same WiFi can connect
    // Local dev proxy: forwards /api requests to local Express server
    proxy: {
      '/api': {
        target: 'http://localhost:5000',
        changeOrigin: true
      }
    }
  }
})
