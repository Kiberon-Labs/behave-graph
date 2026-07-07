// Pre-generates the image scene's before → after payoff with the SAME
// ImageMagick (wasm) operations the on-screen pipeline graph performs
// (image/resize → image/oilpaint → image/sepia), so the overlay card shows a
// truthful result and renders are deterministic regardless of in-browser wasm
// timing. Also normalizes source.png to a real PNG (the downloaded original is
// a JPEG), so strict browser decode paths never trip on the extension.
//
//   corepack pnpm --filter @kiberon-labs/behave-graph-video image-demo
import { readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  ImageMagick,
  MagickFormat,
  initializeImageMagick,
  type IMagickImage
} from '@imagemagick/magick-wasm';

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), '..');
const demoDir = join(packageRoot, 'public', 'image-demo');

const require = createRequire(import.meta.url);
const wasmPath = join(
  dirname(require.resolve('@imagemagick/magick-wasm')),
  'magick.wasm'
);
await initializeImageMagick(await readFile(wasmPath));

// The write callback receives a view into WASM heap memory that is freed when
// read() returns  copy it out synchronously (same rule as the image pack's
// own transformImage util).
const transform = (
  bytes: Uint8Array,
  op: (img: IMagickImage) => void
): Uint8Array =>
  ImageMagick.read(bytes, (img) => {
    op(img);
    return img.write(MagickFormat.Png, (data) => new Uint8Array(data));
  });

const original = new Uint8Array(await readFile(join(demoDir, 'source.png')));

const normalized = transform(original, () => { });
await writeFile(join(demoDir, 'source.png'), normalized);

const after = transform(normalized, (img) => {
  img.resize(640, 480);
  img.oilPaint(3);
  img.sepiaTone();
});
await writeFile(join(demoDir, 'after.png'), after);

console.log(
  `Normalized source.png (${normalized.byteLength}b) and wrote after.png (${after.byteLength}b  resize 640×480 → oil-paint 3 → sepia)`
);
