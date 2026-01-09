import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: '/comfydocs/',
  plugins: [react()],
  build: {
    // Increase the chunk size warning limit to 1000 kB (1 MB) to suppress warnings for slightly larger chunks
    chunkSizeWarningLimit: 1000,
    rollupOptions: {
      output: {
        manualChunks: {
          // Separate vendor chunks to optimize loading and cache validation
          'vendor-react': ['react', 'react-dom'],
          'vendor-ai': ['@google/genai'],
          'vendor-ui': ['lucide-react', 'react-markdown'],
        },
      },
    },
  },
});
