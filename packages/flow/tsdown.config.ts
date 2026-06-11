import { defineConfig } from 'tsdown';
import LightningCSS from 'unplugin-lightningcss/rolldown';

export default defineConfig({
  entry: {
    index: './src/index.ts'
  },

  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  tsconfig: 'tsconfig.prod.json',
  skipNodeModulesBundle: true,
  copy: [{ from: 'src/entry.css', to: 'dist/entry.css' }],
  plugins: [LightningCSS({ options: { minify: true } })],
  external: [
    '@kiberon-labs/behave-graph',
    '@vscode-elements/react-elements',
    'rc-dock',
    'rc-menu'
  ],
  format: ['esm'],
  dts: true,
  // unbundle: true,
  logLevel: 'warn',
  platform: 'neutral'
});
