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

  // Build a list of absolute candidate paths. Prefer the package's own
  // exported `./magick.wasm` subpath (the only reliable entry, since modern
  // `exports` maps block `./package.json`), then fall back to locating the
  // wasm next to the resolved main entry.
  const candidates: string[] = [];

  try {
    candidates.push(require.resolve('@imagemagick/magick-wasm/magick.wasm'));
  } catch {
    // Subpath not exported in this version; fall through to entry-relative.
  }

  try {
    const entry = require.resolve('@imagemagick/magick-wasm');
    const entryDir = path.dirname(entry);
    for (const rel of [
      'magick.wasm',
      'dist/magick.wasm',
      'build/magick.wasm',
      'lib/magick.wasm',
      'magick_bg.wasm',
      'dist/magick_bg.wasm'
    ]) {
      candidates.push(path.join(entryDir, rel));
    }
  } catch {
    // Entry not resolvable; the candidate list may still hold the subpath.
  }

  let lastError: unknown;
  for (const absPath of candidates) {
    try {
      const buf = await fs.readFile(absPath);
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
    } catch (err) {
      lastError = err;
    }
  }

  throw new Error(
    `Unable to locate ImageMagick WASM in @imagemagick/magick-wasm. Tried: ${
      candidates.join(', ') || '(no candidates resolved)'
    }. Last error: ${String(lastError)}`
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
