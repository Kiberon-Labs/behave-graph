import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  format: ['esm'],
  dts: true,
  logLevel: 'warn',
  unbundle: true,
  platform: 'neutral'
});
