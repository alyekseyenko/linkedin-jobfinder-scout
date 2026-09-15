import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

// Dentro do Docker: VITE_API_URL=http://neural-backend:3001
// Desenvolvimento local: usa localhost:3001
const backendUrl = process.env.VITE_API_URL || 'http://localhost:3001'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  server: {
    host: '0.0.0.0', // necessário para funcionar dentro do Docker
    port: 5173,
    proxy: {
      '/api': {
        target: backendUrl,
        changeOrigin: true,
        timeout: 120000,
        proxyTimeout: 120000
      }
    }
  },
  build: {
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('three') || id.includes('@react-three')) {
              return 'vendor-three';
            }
            if (id.includes('framer-motion') || id.includes('gsap') || id.includes('@gsap')) {
              return 'vendor-anim';
            }
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('@dnd-kit')) {
              return 'vendor-dnd';
            }
            if (id.includes('jspdf')) {
              return 'vendor-pdf';
            }
            if (id.includes('lottie') || id.includes('@lottiefiles')) {
              return 'vendor-lottie';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
            if (id.includes('react') || id.includes('react-dom') || id.includes('react-router')) {
              return 'vendor-react';
            }
            return 'vendor-core';
          }
        }
      }
    }
  },
  // @ts-ignore
  test: {
    environment: 'jsdom',
    globals: true,
  }
})
