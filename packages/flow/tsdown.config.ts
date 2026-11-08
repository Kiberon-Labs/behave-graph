import { readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
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
  // Lazy plugin CSS is emitted separately. Include every stylesheet in the
  // public CSS entry so consumers receive documentation and other panel styles.
  onSuccess: async (config) => {
    const styles = (await readdir(config.outDir))
      .filter(
        (file) =>
          file.endsWith('.css') && file !== 'entry.css' && file !== 'index.css'
      )
      .sort();
    const source = await readFile(resolve(config.cwd, 'src/entry.css'), 'utf8');
    await writeFile(
      resolve(config.outDir, 'entry.css'),
      source.trimEnd() +
        '\n' +
        styles.map((file) => `@import "./${file}";`).join('\n') +
        '\n'
    );
  },
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
