import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => {
  // Load env file based on `mode` in the current working directory
  const env = loadEnv(mode, process.cwd(), '')

  return {
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
            // Add SmartSuite headers for development
            const apiKey = env.VITE_SMARTSUITE_API_KEY || '';

            // Debug: Log API key status (not the key itself)
            if (!apiKey) {
              console.error('[Dev Proxy] WARNING: No API key found!');
            } else {
              console.log('[Dev Proxy] API key loaded');
            }

            proxyReq.setHeader('Authorization', `Token ${apiKey}`);
            proxyReq.setHeader('ACCOUNT-ID', 's3qnmox1');
            proxyReq.setHeader('Content-Type', 'application/json');

            // Log the request for debugging
            console.log(`[Dev Proxy] ${req.method} ${req.url}`);
          });
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log(`[Dev Proxy Response] ${proxyRes.statusCode} for ${req.url}`);
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
  }
})