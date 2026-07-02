import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: [
    './src/index.ts',
    './src/manifest.source.ts',
    './src/ui/controls/vec3.tsx'
  ],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  format: ['esm'],
  dts: true,
  logLevel: 'warn',
  unbundle: true,
  platform: 'neutral'
});
