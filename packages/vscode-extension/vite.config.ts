import { defineConfig } from 'vite';
import tailwindcss from '@tailwindcss/vite';

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    port: 3000
  },
  build: {
    target: 'es2015',
    manifest: true,
    // Relative to root
    outDir: './build',
    emptyOutDir: true // also necessary
  },
  plugins: [tailwindcss()]
});
