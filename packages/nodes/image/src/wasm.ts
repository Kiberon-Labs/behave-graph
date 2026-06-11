import { initializeImageMagick } from '@imagemagick/magick-wasm';

let initPromise: Promise<void> | undefined;

function isNodeRuntime() {
  return (
    typeof window === 'undefined' &&
    typeof process !== 'undefined' &&
    typeof process.versions === 'object' &&
    !!process.versions?.node
  );
}

async function loadMagickWasmBytesBrowser(): Promise<ArrayBuffer> {
  const mod = await import('@imagemagick/magick-wasm/magick.wasm?url');
  const wasmUrl = mod.default;

  const res = await fetch(wasmUrl);
  if (!res.ok) {
    throw new Error(
      `Failed to load ImageMagick WASM: ${res.status} ${res.statusText}`
    );
  }
  return await res.arrayBuffer();
}

async function loadMagickWasmBytesNode(): Promise<ArrayBuffer> {
  const [{ createRequire }, path, fs] = await Promise.all([
    import('node:module'),
    import('node:path'),
    import('node:fs/promises')
  ]);

  const require = createRequire(import.meta.url);
  const pkgJsonPath = require.resolve('@imagemagick/magick-wasm/package.json');
  const pkgDir = path.dirname(pkgJsonPath);

  const candidates = [
    'magick.wasm',
    'dist/magick.wasm',
    'build/magick.wasm',
    'lib/magick.wasm',
    'magick_bg.wasm',
    'dist/magick_bg.wasm',
    'build/magick_bg.wasm',
    'lib/magick_bg.wasm'
  ];

  let lastError: unknown;
  for (const relPath of candidates) {
    const absPath = path.join(pkgDir, relPath);
    try {
      const buf = await fs.readFile(absPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Unable to locate ImageMagick WASM in @imagemagick/magick-wasm. Tried: ${candidates.join(
      ', '
    )}. Last error: ${String(lastError)}`
  );
}

export function ensureImageMagickInitialized(): Promise<void> {
  initPromise ??= (async () => {
    const wasmBytes = isNodeRuntime()
      ? await loadMagickWasmBytesNode()
      : await loadMagickWasmBytesBrowser();
    await initializeImageMagick(wasmBytes);
  })();

  return initPromise;
}
