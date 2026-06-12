import path from 'node:path';
import { configDefaults, defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    // Visual/pixel regression tests run in a real browser via the dedicated
    // vitest.visual.config.ts — keep them out of the happy-dom unit run.
    exclude: [...configDefaults.exclude, '**/*.visual.test.{ts,tsx}'],
    watch: false,
    environment: 'happy-dom'
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src')
    }
  }
});
