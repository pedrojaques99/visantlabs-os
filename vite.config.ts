import path from 'path';
import { fileURLToPath } from 'url';
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ mode }) => {
  const aliasPath = path.resolve(__dirname, './src');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
      watch: {
        ignored: ['**/.data/**'],
      },
      proxy: {
        '/api': {
          target: `http://localhost:${process.env.SERVER_PORT || 3001}`,
          changeOrigin: true,
          secure: false,
          timeout: 600000,
          proxyTimeout: 600000,
          configure: (proxy) => {
            proxy.on('error', () => {}); // suppress ECONNREFUSED flood while server boots
          },
        }
      }
    },
    plugins: [react(), tailwindcss()],
    // SECURITY: Do NOT expose API keys in frontend bundle
    // All API keys should only be used server-side via /api endpoints
    resolve: {
      alias: {
        '@': aliasPath,
      }
    },
    optimizeDeps: {
      esbuildOptions: {
        target: 'es2022',
        platform: 'browser',
      },
    },
    build: {
      target: 'es2022',
      esbuild: {
        target: 'es2022',
        legalComments: 'none',
      },
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            // React, ReactDOM, and Radix UI - Keep in main bundle to ensure they load first
            // Prevents "Cannot read properties of undefined (reading 'createContext'/'forwardRef')"
            // errors when components use React APIs at module load time
            if (
              id.includes('node_modules/react/') ||
              id.includes('node_modules/react-dom/') ||
              id.includes('node_modules/@radix-ui/') ||
              id.includes('node_modules/lucide-react/')
            ) {
              return undefined; // Keep in main bundle
            }

            // React Flow (heavy library)
            if (id.includes('node_modules/@xyflow/')) {
              return 'reactflow-vendor';
            }

            // PDF libraries
            if (id.includes('node_modules/react-pdf/') ||
              id.includes('node_modules/pdf-lib/') ||
              id.includes('node_modules/jspdf/') ||
              id.includes('node_modules/pdfjs')) {
              return 'pdf-vendor';
            }

            // Liveblocks (collaboration)
            if (id.includes('node_modules/@liveblocks/')) {
              return 'liveblocks-vendor';
            }

            // AI/ML libraries
            if (id.includes('node_modules/@google/genai/') ||
              id.includes('node_modules/ai/') ||
              id.includes('node_modules/@ai-sdk/')) {
              return 'ai-vendor';
            }

            // Markdown and syntax highlighting
            if (id.includes('node_modules/react-markdown/') ||
              id.includes('node_modules/react-syntax-highlighter/') ||
              id.includes('node_modules/shiki/') ||
              id.includes('node_modules/remark-') ||
              id.includes('node_modules/rehype-')) {
              return 'markdown-vendor';
            }

            // Stripe and payment
            if (id.includes('node_modules/@stripe/') ||
              id.includes('node_modules/stripe/') ||
              id.includes('node_modules/abacatepay-')) {
              return 'payment-vendor';
            }

            // Other node_modules
            if (id.includes('node_modules/')) {
              return 'vendor';
            }
            return undefined;
          },
        },
      },
    },
  };
});
