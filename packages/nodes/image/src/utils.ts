import type { IMagickImage } from '@imagemagick/magick-wasm';
import { ImageMagick } from '@imagemagick/magick-wasm';

export const cloneImage = (image: Uint8Array): Uint8Array => {
  const dst = new ArrayBuffer(image.byteLength);
  const final = new Uint8Array(dst);
  final.set(new Uint8Array(image));
  return final;
};

/**
 * Decode `image`, apply a mutating ImageMagick operation, and re-encode the
 * result. The input is cloned first so the source socket buffer is never
 * detached/mutated, matching the behaviour of the hand-written transform nodes.
 */
export const transformImage = async (
  image: Uint8Array,
  op: (img: IMagickImage) => void | Promise<void>
): Promise<Uint8Array> =>
  ImageMagick.read(cloneImage(image), async (img: IMagickImage) => {
    await op(img);
    // `data` is a view into WASM heap memory that is freed once `read`
    // disposes the image, so copy it out before returning.
    return img.write((data) => cloneImage(data));
  });

/**
 * Resolve a value from one of ImageMagick's const-object "enums" (e.g.
 * `Gravity`, `NoiseType`) by its string key, falling back to `fallback` when
 * the key is missing or unknown.
 */
export const enumValue = <T extends Record<string, V>, V>(
  enumObject: T,
  key: string | undefined,
  fallback: V
): V => {
  if (key !== undefined && key in enumObject) {
    return enumObject[key as keyof T];
  }
  return fallback;
};

/** Clamp `value` to an integer within [min, max]. */
export const clampInt = (value: number, min: number, max: number): number => {
  const truncated = Number.isFinite(value) ? Math.trunc(value) : min;
  return Math.min(max, Math.max(min, truncated));
};
