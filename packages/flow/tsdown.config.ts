import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  skipNodeModulesBundle: true,
  external: ['@kiberon-labs/behave-graph'],
  format: ['esm'],
  dts: true,
  logLevel: 'warn',
  unbundle: true,
  platform: 'neutral'
});
