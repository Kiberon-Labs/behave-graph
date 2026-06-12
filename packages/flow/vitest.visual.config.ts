import path from 'node:path';
import { playwright } from '@vitest/browser-playwright';
import { defineConfig } from 'vitest/config';

/**
 * Dedicated config for visual (pixel) regression tests.
 *
 * These run in a real browser via Vitest browser mode + Playwright and use the
 * built-in `toMatchScreenshot` assertion to detect rendering regressions.
 *
 * Run with `pnpm test:visual` (and `pnpm test:visual:update` to refresh
 * baselines). It is intentionally separate from the default happy-dom unit-test
 * config so the heavy browser runner is only spun up when explicitly requested.
 *
 * Screenshots are platform-sensitive (fonts/anti-aliasing differ across OSes),
 * so Vitest stores baselines under per-platform folders. Generate/refresh
 * baselines on the same platform/CI image that will verify them.
 */
export default defineConfig({
  test: {
    include: ['tests/visual/**/*.visual.test.{ts,tsx}'],
    watch: false,
    browser: {
      enabled: true,
      provider: playwright(),
      headless: true,
      instances: [{ browser: 'chromium' }],
      // Deterministic viewport, large enough to contain a panel frame without
      // introducing page scrollbars that would shift layout.
      viewport: { width: 900, height: 700 },
      expect: {
        toMatchScreenshot: {
          // Allow a tiny amount of anti-aliasing noise without failing.
          comparatorName: 'pixelmatch',
          comparatorOptions: {
            allowedMismatchedPixelRatio: 0.02
          }
        }
      }
    }
  },
  resolve: {
    alias: {
      '~': path.resolve(__dirname, './src'),
      '@': path.resolve(__dirname, './src')
    }
  }
});
