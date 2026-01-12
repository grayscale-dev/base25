import react from '@vitejs/plugin-react'
import { defineConfig, loadEnv } from 'vite'
import path from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  const supabaseUrl = env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';

  return {
    resolve: {
      alias: {
        '@': path.resolve(__dirname, 'src'),
      },
    },
    plugins: [
      react(),
    ],
    server: {
      proxy: {
        '/api/interactions': {
          target: `${supabaseUrl}/functions/v1`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/api\/interactions/, '/recordInteraction'),
        },
      },
    },
  };
});
