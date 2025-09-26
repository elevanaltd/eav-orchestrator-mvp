import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api/smartsuite': {
        target: 'https://app.smartsuite.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/smartsuite/, ''),
        configure: (proxy, _options) => {
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Add SmartSuite headers (correct format from knowledge base)
            proxyReq.setHeader('Authorization', `Token ${process.env.VITE_SMARTSUITE_API_KEY || 'c9aa49f9b94dfc8b6bc88299f4dffad7f179618c'}`);
            proxyReq.setHeader('ACCOUNT-ID', 's3qnmox1');
            proxyReq.setHeader('Content-Type', 'application/json');
          });
        }
      }
    }
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: './src/test/setup.ts',
    css: true
  }
})