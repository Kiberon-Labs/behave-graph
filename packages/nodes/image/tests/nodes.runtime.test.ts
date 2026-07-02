import { beforeAll, describe, expect, it } from 'vitest';
import { ensureImageMagickInitialized } from '../src/wasm.js';
import { nodes } from '../src/nodes/index.js';

/**
 * Executes every image node against a real WASM-decoded image. The manifest
 * test only projects node *specs* (no execution), so this is what actually
 * exercises the ImageMagick API calls inside each node's `exec`.
 */

type AnyDef = {
  typeName: string;
  in: Record<string, { valueType: string; defaultValue?: unknown }>;
  out: Record<string, unknown> | ((...args: unknown[]) => unknown);
  exec: (params: {
    read: (key: string) => unknown;
    write: (key: string, value: unknown) => void;
  }) => Promise<void> | void;
};

async function runNode(
  def: AnyDef,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, unknown>> {
  const inputs: Record<string, unknown> = {};
  for (const [key, socket] of Object.entries(def.in)) {
    inputs[key] = socket.defaultValue;
  }
  Object.assign(inputs, overrides);

  const outputs: Record<string, unknown> = {};
  await def.exec({
    read: (key: string) => inputs[key],
    write: (key: string, value: unknown) => {
      outputs[key] = value;
    }
  });
  return outputs;
}

// Nodes that can't run with a synthetic in-memory image: a network fetch and
// the no-op output sink.
const SKIP = new Set(['image/fetch', 'output/image']);

describe('image node runtime execution', () => {
  let base: Uint8Array;

  beforeAll(async () => {
    await ensureImageMagickInitialized();
    const out = await runNode(nodes['image/solidColor'] as unknown as AnyDef, {
      width: 32,
      height: 32,
      r: 128,
      g: 64,
      b: 200,
      a: 255
    });
    base = out.image as Uint8Array;
  });

  it('produces a valid base image from image/solidColor', () => {
    expect(base).toBeInstanceOf(Uint8Array);
    expect(base.byteLength).toBeGreaterThan(0);
  });

  it('reads metadata via image/properties', async () => {
    const props = await runNode(
      nodes['image/properties'] as unknown as AnyDef,
      { image: base }
    );
    expect(props.width).toBe(32);
    expect(props.height).toBe(32);
    expect(typeof props.format).toBe('string');
  });

  const imageOutNodes = Object.values(nodes).filter((def) => {
    const d = def as unknown as AnyDef;
    if (SKIP.has(d.typeName)) return false;
    if (typeof d.out === 'function') return false;
    return 'image' in (d.out as Record<string, unknown>);
  }) as unknown as AnyDef[];

  it.each(imageOutNodes.map((d) => [d.typeName, d] as const))(
    'executes %s and returns a non-empty image',
    async (_typeName, def) => {
      // Supply the base image for every image-typed input (image / a / b).
      const overrides: Record<string, unknown> = {};
      for (const [key, socket] of Object.entries(def.in)) {
        if (socket.valueType === 'image') overrides[key] = base;
      }
      const out = await runNode(def, overrides);
      expect(out.image).toBeInstanceOf(Uint8Array);
      expect((out.image as Uint8Array).byteLength).toBeGreaterThan(0);
    }
  );
});
