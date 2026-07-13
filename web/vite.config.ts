import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://localhost:5138',
      '/health': 'http://localhost:5138',
      '/swagger': 'http://localhost:5138',
    },
  },
  build: {
    outDir: '../src/LoboFlix.Api/wwwroot',
    emptyOutDir: true,
  },
});
