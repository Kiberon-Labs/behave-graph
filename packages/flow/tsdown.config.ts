import { defineConfig } from 'tsdown';
import { tailwindPlugin } from '@bosh-code/tsdown-plugin-tailwindcss';
import { injectCssPlugin } from '@bosh-code/tsdown-plugin-inject-css';

export default defineConfig({
  entry: ['./src/index.ts'],
  outDir: 'dist',
  target: 'es2022',
  sourcemap: true,
  tsconfig: 'tsconfig.prod.json',
  skipNodeModulesBundle: true,
  plugins: [tailwindPlugin(), injectCssPlugin()],
  external: [
    '@kinforge/behave-graph',
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
