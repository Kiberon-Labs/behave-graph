---
"@kiberon-labs/behave-graph-nodes-image": minor
---

Greatly expand the image node set and fix latent WASM buffer / loader bugs.

## New nodes (13 → 39)

Added 26 nodes built on `@imagemagick/magick-wasm`, organized by category:

- **Geometry / transform**: `image/resize`, `image/crop`, `image/rotate`,
  `image/thumbnail`, `image/trim`, `image/extent` (canvas resize with
  background fill), `image/border`.
- **Color / tone**: `image/brightnessContrast`, `image/modulate` (HSB),
  `image/level`, `image/gamma`, `image/normalize`, `image/autoLevel`,
  `image/autoGamma`, `image/sigmoidalContrast`, `image/threshold`,
  `image/blueShift`.
- **Blur / sharpen / artistic effects**: `image/gaussianBlur`,
  `image/adaptiveBlur`, `image/motionBlur`, `image/sharpen`, `image/charcoal`,
  `image/wave`, `image/noise`.
- **Format**: `image/convert` — re-encode to PNG / JPEG / WebP / GIF / BMP /
  TIFF with an optional quality setting.
- **Inspection**: `image/properties` — reads width, height, format, total
  colors, colorspace, density, depth and alpha. (This was previously dead code
  that mistakenly declared `typeName: 'image/negate'` and was never registered.)

## Bug fixes

- **Freed WASM-heap output buffers**: `image.write((data) => data)` returns a
  `Uint8Array` that views WASM heap memory freed once the image is disposed, so
  node outputs became garbage as soon as a later operation reused that memory
  (surfacing as `NoDecodeDelegateForThisImageFormat`). All image-producing nodes
  now copy the bytes out inside the write callback, centralized in a new
  `transformImage` helper in `src/utils.ts`.
- **Broken Node WASM loader**: `src/wasm.ts` resolved
  `@imagemagick/magick-wasm/package.json`, which the package's `exports` map
  blocks — the Node-side runner could never initialize ImageMagick. It now
  resolves the wasm via the exported `./magick.wasm` subpath (and the resolved
  main entry's directory).
- **`image/solidColor` blue channel**: the blue value was clamped to `[200, 255]`
  instead of `[0, 255]`, making non-blue solid colors impossible.

## Internal

- Existing transform nodes (`blur`, `flip`, `grayscale`, `negate`, `sepia`,
  `solarize`, `vignette`, `canny`, `oilpaint`) were refactored through the shared
  `transformImage` helper; `compose` copies its composited output out of WASM
  memory.
- Added `tests/nodes.runtime.test.ts`, which initializes real WASM and executes
  every image-output node end-to-end (the existing manifest test only projects
  node specs without running them).
