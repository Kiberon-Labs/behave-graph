import { defineConfig } from 'vite';
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
    emptyOutDir: true, // also necessary
    rollupOptions: {
      output: {
        // Split the large, stable vendor libraries into their own chunks. This
        // does not shrink the total first-paint parse (all of these are needed
        // to render the editor), but it lets the webview cache the vendor code
        // across reloads and fetch chunks in parallel. Code that is genuinely
        // deferrable is split via dynamic `import()` at its use site instead
        // (see the lazy docs panel, note nodes, layout engines, and the `any`
        // control), which is what actually reduces first-paint work.
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (/[\\/]react-dom[\\/]/.test(id) || /[\\/]scheduler[\\/]/.test(id))
            return 'vendor-react-dom';
          if (/[\\/]@?reactflow[\\/]/.test(id)) return 'vendor-reactflow';
          if (
            /[\\/]@vscode-elements[\\/]/.test(id) ||
            /[\\/]lit(-|[\\/])/.test(id)
          )
            return 'vendor-vscode-elements';
          return undefined;
        }
      }
    }
  }
});
