# @kiberon-labs/behave-graph-nodes-image

Image manipulation nodes for [behave-graph](https://behave-graph.kiberonlabs.com). This package adds **71 nodes** that decode, transform, and re-encode images using [ImageMagick](https://imagemagick.org/) compiled to WebAssembly ([`@imagemagick/magick-wasm`](https://github.com/dlemstra/magick-wasm)), so the same graph runs in the browser and in a Node backend.

Images flow between nodes as PNG-encoded `Uint8Array` buffers under a single `image` value type.

## Install

```sh
pnpm add @kiberon-labs/behave-graph-nodes-image
```

Peer dependencies:

| Peer | Required for | Optional |
|---|---|---|
| `@kiberon-labs/behave-graph` | core registry (always) | no |
| `@kiberon-labs/behave-graph-flow` | the editor UI plugin only | yes |
| `react`, `react-dom` | the editor UI plugin only | yes |

The runtime WASM binary ships inside `@imagemagick/magick-wasm` and is resolved automatically (see [Loading the WASM runtime](#loading-the-wasm-runtime)); you do not install or copy it yourself.

## Usage

### Headless (no UI)

`registerProfile` initializes the ImageMagick WASM runtime and merges the image nodes and value type into an existing registry. It is async because WASM initialization is async.

```ts
import { registerProfile } from '@kiberon-labs/behave-graph-nodes-image';

const registry = await registerProfile(existingRegistry);
```

This is all you need to run image graphs on a server, in a worker, or in a test.

### With the flow editor UI

The `./ui` entry adds the editor-side contributions (an image control, an inline preview, and an output panel). It depends on `@kiberon-labs/behave-graph-flow` and React.

```ts
import { imagePlugin } from '@kiberon-labs/behave-graph-nodes-image/ui';
```

### Running a node directly

Every node is a plain descriptor with an `exec` function. The test harness in [`tests/harness.ts`](tests/harness.ts) shows the minimal shim for running one outside the graph engine:

```ts
import { loadImageNodes, runNode, makeTestImage } from './tests/harness.js';

const nodes = await loadImageNodes();          // inits WASM, returns the node map
const base = await makeTestImage(nodes);       // a 32x32 solid-color PNG
const { image } = await runNode(nodes['image/blur'], {
  image: base,
  radius: 0,
  sigma: 3
});
// `image` is a PNG-encoded Uint8Array
```

## Loading the WASM runtime

`registerProfile` calls `ensureImageMagickInitialized()` once per process. The loader ([`src/wasm.ts`](src/wasm.ts)) detects the environment:

- **Browser**: imports the `.wasm` asset URL and `fetch`es it. Your bundler must be able to resolve `@imagemagick/magick-wasm/magick.wasm?url` (Vite and similar handle this out of the box).
- **Node**: locates `magick.wasm` inside the installed `@imagemagick/magick-wasm` package via `createRequire` and reads it from disk.

Initialization is idempotent, so calling `registerProfile` more than once is safe.

## The WASM heap gotcha

When ImageMagick returns encoded bytes, that `Uint8Array` is a **view into WASM heap memory that is freed as soon as the image is disposed**. Reading it after disposal yields garbage or an empty buffer.

Every node copies the bytes out before the image is disposed. The shared helper `transformImage` in [`src/utils.ts`](src/utils.ts) does this for you:

```ts
import { transformImage } from '@/utils.js';

// decode -> mutate -> copy-out-and-re-encode, with the source buffer left intact
const out = await transformImage(input, (img) => img.blur(0, 3));
```

If you add a node that reaches for `img.write(...)` directly, copy the bytes inside the callback (`img.write((data) => cloneImage(data))`) rather than returning the view.

## Node catalog

All nodes use the `image` value type for image inputs and outputs. Type names are `image/*` except the output sink (`output/image`).

### Sources
| Node | Description |
|---|---|
| `image/solidColor` | Create a solid RGBA image of a given size |
| `image/fetch` | Load an image from a URL |

### Output and inspection
| Node | Description |
|---|---|
| `output/image` | Sink for previewing/collecting a result |
| `image/preview` | Pass-through that always shows an inline preview, ignoring the `image.showPreview` setting |
| `image/properties` | Read width, height, format, color count, colorspace, density, depth, alpha |

### Geometry and transform
| Node | Description |
|---|---|
| `image/resize` | Resize to width/height |
| `image/adaptiveResize` | Resize with data-dependent triangulation |
| `image/liquidRescale` | Content-aware (seam-carving) resize |
| `image/crop` | Crop to a size with gravity |
| `image/chop` | Cut a region out, closing the gap |
| `image/splice` | Insert a background block, growing the image |
| `image/shave` | Remove pixels from the edges |
| `image/rotate` | Rotate by degrees |
| `image/roll` | Offset (wrap) the image by x/y |
| `image/deskew` | Straighten a skewed scan |
| `image/autoOrient` | Apply the stored EXIF orientation |
| `image/thumbnail` | Fast thumbnail resize |
| `image/trim` | Trim uniform border pixels |
| `image/extent` | Set the canvas size |
| `image/border` | Add a border |
| `image/flip` | Mirror vertically |
| `image/flop` | Mirror horizontally |

### Color and tone
| Node | Description |
|---|---|
| `image/grayscale` | Convert to grayscale |
| `image/negate` | Invert all channels |
| `image/negateGrayscale` | Invert only intensity |
| `image/sepia` | Sepia tone |
| `image/solarize` | Solarize |
| `image/brightnessContrast` | Adjust brightness and contrast |
| `image/contrast` | Enhance or reduce contrast |
| `image/contrastStretch` | Stretch tonal range by black/white percentages |
| `image/linearStretch` | Linear histogram remap |
| `image/modulate` | Adjust brightness, saturation, hue |
| `image/level` | Levels adjustment |
| `image/gamma` | Gamma correction |
| `image/normalize` | Normalize contrast |
| `image/autoLevel` | Automatic levels |
| `image/autoGamma` | Automatic gamma |
| `image/clahe` | Contrast Limited Adaptive Histogram Equalization |
| `image/sigmoidalContrast` | Sigmoidal contrast |
| `image/inverseSigmoidalContrast` | Reduce contrast around the midpoint |
| `image/threshold` | Global threshold |
| `image/autoThreshold` | Automatic threshold (Kapur/OTSU/Triangle) |
| `image/adaptiveThreshold` | Local windowed threshold |
| `image/blackThreshold` | Force dark pixels to black |
| `image/whiteThreshold` | Force light pixels to white |
| `image/blueShift` | Simulate moonlight (blue shift) |
| `image/evaluate` | Per-pixel arithmetic/bitwise operator |

### Alpha and color replacement
| Node | Description |
|---|---|
| `image/alpha` | Manipulate the alpha channel |
| `image/colorAlpha` | Flatten transparency over a solid color |
| `image/opaque` | Replace one color with another |
| `image/transparent` | Make a color transparent |
| `image/floodFill` | Bucket-fill a region from a point |

### Blur, sharpen, and artistic effects
| Node | Description |
|---|---|
| `image/blur` | Blur |
| `image/gaussianBlur` | Gaussian blur |
| `image/adaptiveBlur` | Edge-aware blur |
| `image/motionBlur` | Directional motion blur |
| `image/bilateralBlur` | Edge-preserving smoothing |
| `image/sharpen` | Sharpen |
| `image/adaptiveSharpen` | Edge-aware sharpen |
| `image/oilpaint` | Oil-paint effect |
| `image/charcoal` | Charcoal sketch effect |
| `image/vignette` | Vignette |
| `image/canny` | Canny edge detection |
| `image/wave` | Sine-wave distortion |
| `image/distort` | Geometric distortion (rotate, arc, perspective...) |
| `image/noise` | Add noise |

### Compositing, format, and metadata
| Node | Description |
|---|---|
| `image/compose` | Composite two images with a compositing operator |
| `image/clut` | Recolor through a color lookup table |
| `image/quantize` | Reduce to N colors |
| `image/strip` | Remove profiles and metadata |
| `image/convert` | Convert to another format |

## Testing

The package is exercised in a plain Node process against the real WASM runtime, which is what proves it works on a backend and not only in the browser.

```sh
pnpm test
```

- [`tests/harness.ts`](tests/harness.ts) exposes `loadImageNodes()`, `runNode()`, and `makeTestImage()` for running any node locally.
- [`tests/nodes.runtime.test.ts`](tests/nodes.runtime.test.ts) executes every image-producing node against a decoded image and asserts a non-empty result.
- [`tests/manifest.test.ts`](tests/manifest.test.ts) validates the generated static manifest.

## License

ISC. See the repository root [LICENSE](https://github.com/Kiberon-Labs/behave-graph/blob/master/LICENSE).
