import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'
import fs from 'node:fs'

const isDocker = fs.existsSync('/.dockerenv')
const backendTarget = process.env.VITE_API_PROXY_TARGET || process.env.BACKEND_URL || (isDocker ? 'http://backend:5000' : 'http://localhost:5000')

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    host: '0.0.0.0',
    port: 5173,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/uploads': {
        target: backendTarget,
        changeOrigin: true,
      },
      '/api': {
        target: backendTarget,
        changeOrigin: true,
      },
    },
  },
})
