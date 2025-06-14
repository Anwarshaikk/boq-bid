import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// Enable proxy to backend API using VITE_API_URL when provided
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react()],
    server: {
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:8080',
          changeOrigin: true,
        },
      },
    },
  }
})
