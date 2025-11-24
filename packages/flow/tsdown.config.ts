import { defineConfig } from 'tsdown';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  tsconfig: 'tsconfig.prod.json',
  skipNodeModulesBundle: true,
  external: [
    '@kiberon-labs/behave-graph',
    '@vscode-elements/react-elements',
    'rc-dock',
    'rc-menu'
  ],
  format: ['esm'],
  dts: true,
  logLevel: 'warn',
  unbundle: true,
  platform: 'neutral'
});
