import { ensureImageMagickInitialized } from '../src/wasm.js';
import { nodes } from '../src/nodes/index.js';
import { ImageValue } from '../src/values/index.js';

/**
 * Node-side test harness for the image package.
 *
 * The nodes decode/encode real images through the ImageMagick WASM runtime, so
 * exercising them outside the browser needs two things: the WASM binary loaded
 * (via the Node loader in `wasm.ts`) and a small shim that plays the role the
 * graph engine normally plays around a node's `exec` (feeding inputs, capturing
 * outputs). This file provides both so any node can be run from a plain Node
 * process or a `vitest` case without spinning up a flow UI.
 */

/** Minimal structural view of a node descriptor's runnable surface. */
export type ImageNodeDef = {
  typeName: string;
  label?: string;
  in: Record<string, { valueType: string; defaultValue?: unknown }>;
  out: Record<string, unknown> | ((...args: unknown[]) => unknown);
  exec: (params: {
    read: (key: string) => unknown;
    write: (key: string, value: unknown) => void;
  }) => Promise<void> | void;
};

/**
 * Initialize the ImageMagick WASM runtime and return the package's node map.
 * Idempotent: WASM is only loaded once per process (see `ensureImageMagickInitialized`).
 */
export const loadImageNodes = async (): Promise<
  Record<string, ImageNodeDef>
> => {
  await ensureImageMagickInitialized();
  return nodes as unknown as Record<string, ImageNodeDef>;
};

/**
 * Run a single node's `exec`, defaulting every input from its socket
 * `defaultValue` and overlaying `overrides`. Returns the written outputs.
 */
export const runNode = async (
  def: ImageNodeDef,
  overrides: Record<string, unknown> = {}
): Promise<Record<string, unknown>> => {
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
};

/**
 * Convenience: produce a small solid-color PNG to feed image-typed inputs.
 * Handy as a fixture for local runs and tests.
 */
export const makeTestImage = async (
  nodeMap: Record<string, ImageNodeDef>,
  {
    width = 32,
    height = 32,
    r = 128,
    g = 64,
    b = 200,
    a = 255
  }: Partial<{
    width: number;
    height: number;
    r: number;
    g: number;
    b: number;
    a: number;
  }> = {}
): Promise<Uint8Array> => {
  const out = await runNode(nodeMap['image/solidColor'], {
    width,
    height,
    r,
    g,
    b,
    a
  });
  return out.image as Uint8Array;
};

/** Which socket keys on a node carry an image value. */
export const imageInputKeys = (def: ImageNodeDef): string[] =>
  Object.entries(def.in)
    .filter(([, socket]) => socket.valueType === ImageValue.name)
    .map(([key]) => key);

/** True when a node produces an `image` output (vs. a pure inspector). */
export const producesImage = (def: ImageNodeDef): boolean =>
  typeof def.out !== 'function' &&
  'image' in (def.out as Record<string, unknown>);
