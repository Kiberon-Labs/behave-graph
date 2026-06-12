# Visual (pixel) regression tests

These tests render React components in a **real browser** (Chromium via Playwright)
and compare a screenshot against a committed baseline using Vitest's built-in
[`toMatchScreenshot`](https://vitest.dev/guide/browser/visual-regression-testing)
assertion. They catch unintended rendering regressions that DOM-only unit tests
miss.

## Scope

Coverage is deliberately minimal and panel-focused: **one snapshot per editor
panel** (see [`panels.visual.test.tsx`](./panels.visual.test.tsx)), since the
panels are the composed, regression-prone surfaces. Each panel is rendered
through the same [`DefaultSystemProvider`](../../stories/defaults/defaultStoryProvider.tsx)
the Storybook stories use, so it shows representative content.

They are intentionally **separate** from the default `pnpm test` run (which uses
happy-dom) so the heavier browser runner only starts when explicitly requested.

## Running

```bash
# one-time: install the Chromium binary Playwright drives
npx playwright install chromium

# verify components against the committed baselines
pnpm test:visual

# create/refresh baselines (after an intentional visual change)
pnpm test:visual:update
```

## How it works

- Config: [`vitest.visual.config.ts`](../../vitest.visual.config.ts) — browser
  mode, Playwright/Chromium, headless, fixed `900x700` viewport.
- Test files: `tests/visual/**/*.visual.test.tsx`.
- Each panel is rendered inside a fixed-size `640x480` frame on the editor
  background so screenshots are bounded and stable. The full app stylesheet
  (`@/index.css`) is imported so `--vscode-*` theme tokens resolve.
- Baselines live in `__screenshots__/` and are committed. Vitest names them per
  platform (e.g. `*-chromium-win32.png`), because font rendering and
  anti-aliasing differ across operating systems.

## Important: baselines are platform-specific

Generate and verify baselines on the **same OS / CI image**. A baseline captured
on Windows will not match one rendered on Linux. For CI, run
`pnpm test:visual:update` on the CI platform once (or in a container that matches
CI) and commit those baselines. The comparator is configured with a small
`allowedMismatchedPixelRatio` to tolerate negligible anti-aliasing noise.

## Adding a panel

When a new panel is added under `src/components/panels`, add one entry to the
`panels` array in [`panels.visual.test.tsx`](./panels.visual.test.tsx):

```tsx
['myPanel', <MyPanel />],
```

Then run `pnpm test:visual:update` to create the baseline, eyeball the generated
PNG, and commit it. Keep it to a single representative snapshot per panel — the
unit tests under `tests/util` and `tests/components` cover finer-grained logic.
