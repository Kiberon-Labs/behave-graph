import { describe, expect, it } from 'vitest';
import { imageSignature } from '../src/components/preview/previewCache.js';

/**
 * `imageSignature` is the content fingerprint that lets the preview cache reuse a
 * blob across the mount/unmount churn React Flow causes when it culls nodes on
 * zoom. Only the pure fingerprint is tested here; the URL cache itself needs
 * `URL.createObjectURL`, a browser API, so it is exercised in Storybook.
 */
describe('imageSignature', () => {
  it('is deterministic for equal byte content', () => {
    const a = new Uint8Array([1, 2, 3, 4, 5]);
    const b = new Uint8Array([1, 2, 3, 4, 5]);
    expect(imageSignature(a)).toBe(imageSignature(b));
  });

  it('encodes length so different-length buffers differ', () => {
    const a = new Uint8Array([1, 2, 3]);
    const b = new Uint8Array([1, 2, 3, 0]);
    expect(imageSignature(a)).not.toBe(imageSignature(b));
  });

  it('distinguishes buffers of equal length but different content', () => {
    const a = new Uint8Array([1, 2, 3, 4]);
    const b = new Uint8Array([4, 3, 2, 1]);
    expect(imageSignature(a)).not.toBe(imageSignature(b));
  });

  it('memoizes per reference (same instance returns the same signature)', () => {
    const bytes = new Uint8Array(10_000).map((_, i) => i % 251);
    const first = imageSignature(bytes);
    const second = imageSignature(bytes);
    expect(second).toBe(first);
  });

  it('samples large buffers cheaply while still reflecting length', () => {
    const big = new Uint8Array(100_000).fill(7);
    const sig = imageSignature(big);
    expect(sig.endsWith(':100000')).toBe(true);
  });
});
