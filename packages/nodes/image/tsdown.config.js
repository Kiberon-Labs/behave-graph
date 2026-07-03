import { defineConfig } from 'tsdown';
export default defineConfig({
    entry: ['./src/index.ts', './src/ui.tsx', './src/manifest.source.ts'],
    outDir: 'dist',
    target: 'es2022',
    sourcemap: true,
    format: ['esm'],
    external: ['node:module', 'node:path', 'node:fs/promises'],
    dts: true,
    logLevel: 'warn',
    unbundle: true,
    platform: 'neutral'
});
