import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'fs'
import path from 'path'

// Shared self-signed cert — same as the backend uses
// Allows microphone access from other devices on the LAN
const certsDir = path.resolve(__dirname, '..', 'backend', 'certs')
const httpsConfig = (() => {
  try {
    return {
      key:  fs.readFileSync(path.join(certsDir, 'key.pem')),
      cert: fs.readFileSync(path.join(certsDir, 'cert.pem')),
    }
  } catch {
    console.warn('[vite] SSL certs not found — falling back to HTTP. Run gen_cert.py first.')
    return undefined
  }
})()

export default defineConfig({
  plugins: [
    tailwindcss(),
    react(),
  ],
  server: {
    host:  '0.0.0.0',   // listen on all interfaces for LAN access
    allowedHosts: true,
    port:  5176,
    https: httpsConfig, // HTTPS = microphone allowed on all devices
    proxy: {
      // Proxy /api calls to the local backend — avoids browser blocking
      // self-signed cert on cross-origin HTTPS fetches
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        secure: false,
        rewrite: (p) => p,      // keep /api prefix (backend expects it)
      },
    },
  },
})
