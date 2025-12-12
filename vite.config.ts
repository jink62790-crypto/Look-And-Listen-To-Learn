import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');
  
  return {
    // base: './' helps locate assets if deployed to a subdirectory or uncertain path
    base: '/', 
    plugins: [react()],
    define: {
      'process.env': JSON.stringify({
        API_KEY: env.API_KEY || '',
        DEEPSEEK_API_KEY: env.DEEPSEEK_API_KEY || '',
        NODE_ENV: mode
      }),
    },
    build: {
      outDir: 'dist',
      sourcemap: true,
      assetsDir: 'assets',
      // Ensure we don't have mixed import issues in production build
      rollupOptions: {
        output: {
          manualChunks: undefined
        }
      }
    }
  };
});