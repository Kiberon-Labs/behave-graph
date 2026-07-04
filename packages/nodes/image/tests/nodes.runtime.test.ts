import { beforeAll, describe, expect, it } from 'vitest';
import { nodes } from '../src/nodes/index.js';
import {
  imageInputKeys,
  loadImageNodes,
  makeTestImage,
  producesImage,
  runNode,
  type ImageNodeDef
} from './harness.js';

/**
 * Executes every image node against a real WASM-decoded image. The manifest
 * test only projects node *specs* (no execution), so this is what actually
 * exercises the ImageMagick API calls inside each node's `exec`.
 *
 * Everything here runs in a plain Node process via the harness (which loads the
 * WASM binary through the Node loader in `src/wasm.ts`), so this doubles as the
 * proof that the package is usable from a Node backend, not just the browser.
 */

// Nodes that can't run with a synthetic in-memory image: a network fetch and
// the no-op output sink.
const SKIP = new Set(['image/fetch', 'output/image']);

// Enumerated synchronously at collection time (listing specs needs no WASM).
const imageOutNodes = Object.values(nodes as Record<string, ImageNodeDef>)
  .filter((def) => !SKIP.has(def.typeName) && producesImage(def))
  .map((def) => [def.typeName, def] as const);

describe('image node runtime execution', () => {
  let base: Uint8Array;

  beforeAll(async () => {
    const loaded = await loadImageNodes();
    base = await makeTestImage(loaded, {
      width: 32,
      height: 32,
      r: 128,
      g: 64,
      b: 200,
      a: 255
    });
  });

  it('produces a valid base image from image/solidColor', () => {
    expect(base).toBeInstanceOf(Uint8Array);
    expect(base.byteLength).toBeGreaterThan(0);
  });

  it('reads metadata via image/properties', async () => {
    const props = await runNode(
      nodes['image/properties'] as unknown as ImageNodeDef,
      { image: base }
    );
    expect(props.width).toBe(32);
    expect(props.height).toBe(32);
    expect(typeof props.format).toBe('string');
  });

  it('covers every image-producing node (guards against untested additions)', () => {
    // If this drops unexpectedly, a node was added without wiring or removed.
    expect(imageOutNodes.length).toBeGreaterThanOrEqual(60);
  });

  it.each(imageOutNodes)(
    'executes %s and returns a non-empty image',
    async (_typeName, def) => {
      // Supply the base image for every image-typed input (image / a / b / clut).
      const overrides: Record<string, unknown> = {};
      for (const key of imageInputKeys(def)) overrides[key] = base;
      const out = await runNode(def, overrides);
      expect(out.image).toBeInstanceOf(Uint8Array);
      expect((out.image as Uint8Array).byteLength).toBeGreaterThan(0);
    }
  );
});
