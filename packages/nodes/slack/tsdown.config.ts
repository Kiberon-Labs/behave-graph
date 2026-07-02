import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts', './src/manifest.source.ts', './src/backend.ts'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  format: ['esm'],
  external: [
    'node:module',
    'node:path',
    'node:fs/promises',
    // Optional, backend-only Slack SDK — pulled in by a server that runs the
    // backend service, never bundled into the base package.
    '@slack/socket-mode',
    '@slack/web-api'
  ],
  dts: true,
  logLevel: 'warn',
  unbundle: true,
  platform: 'neutral'
});
