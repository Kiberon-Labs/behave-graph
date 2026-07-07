import { defineConfig } from 'tsdown';
import LightningCSS from 'unplugin-lightningcss/rolldown';

export default defineConfig({
  entry: ['./src/index.ts', './src/ui.tsx'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  format: ['esm'],
  external: [
    'node:module',
    'node:path',
    'node:fs/promises',
    '@kiberon-labs/behave-graph',
    '@kiberon-labs/behave-graph-flow',
    /^react($|\/)/,
    'react-dom',
    'zustand',
    '@vscode-elements/react-elements',
    'iconoir-react',
    /^ai($|\/)/,
    /^@ai-sdk\//
  ],
  dts: true,
  logLevel: 'warn',
  // Bundled (not `unbundle`) with the same CSS-module pipeline as the flow
  // package: without the plugin the *.module.css imports compile to empty
  // objects, and without bundling the compiled styles land in orphaned hashed
  // files nothing imports  bundling aggregates them to a stable `ui.css`.
  skipNodeModulesBundle: true,
  plugins: [LightningCSS({ options: { minify: true } })],
  platform: 'neutral'
});
