import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/Manifest/cli.ts'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  // The CLI entry imports node builtins; keep them external (the neutral
  // platform would otherwise warn about unresolved `node:` specifiers). The
  // browser-facing library entry imports none of these.
  external: [/^node:/],
  skipNodeModulesBundle: true,
  format: ['esm'],
  dts: true,
  logLevel: 'warn',
  unbundle: true,
  platform: 'neutral'
});
