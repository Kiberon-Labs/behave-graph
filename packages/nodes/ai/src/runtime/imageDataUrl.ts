/**
 * Convert raw image bytes (the `image` value type, a `Uint8Array`) into a
 * self-contained `data:` URL for rendering in the chat panel. Self-contained so
 * the panel needs no object-URL lifecycle bookkeeping. Browser/Node-neutral.
 */

/**
 * A magic-number signature: each entry is a byte offset and its expected value.
 * A file matches the signature when every entry matches (and the file is long
 * enough to cover the highest offset).
 */
interface MimeSignature {
  mime: string;
  bytes: Array<{ offset: number; value: number }>;
}

/**
 * Magic-byte signatures, checked in order. The first match wins, so keep more
 * specific signatures (e.g. WEBP, which also starts with the RIFF marker) ahead
 * of any that would otherwise shadow them.
 */
const MIME_SIGNATURES: MimeSignature[] = [
  {
    mime: 'image/png',
    bytes: [
      { offset: 0, value: 0x89 },
      { offset: 1, value: 0x50 },
      { offset: 2, value: 0x4e },
      { offset: 3, value: 0x47 }
    ]
  },
  {
    mime: 'image/jpeg',
    bytes: [
      { offset: 0, value: 0xff },
      { offset: 1, value: 0xd8 },
      { offset: 2, value: 0xff }
    ]
  },
  {
    mime: 'image/gif',
    bytes: [
      { offset: 0, value: 0x47 },
      { offset: 1, value: 0x49 },
      { offset: 2, value: 0x46 }
    ]
  },
  {
    mime: 'image/webp',
    bytes: [
      { offset: 0, value: 0x52 },
      { offset: 1, value: 0x49 },
      { offset: 2, value: 0x46 },
      { offset: 3, value: 0x46 },
      { offset: 8, value: 0x57 },
      { offset: 9, value: 0x45 },
      { offset: 10, value: 0x42 },
      { offset: 11, value: 0x50 }
    ]
  }
];

/** Does every byte of the signature match the buffer at its offset? */
function matchesSignature(
  bytes: Uint8Array,
  signature: MimeSignature
): boolean {
  return signature.bytes.every(({ offset, value }) => bytes[offset] === value);
}

/** Default MIME used when no signature matches (also PNG for unknown bytes). */
const FALLBACK_MIME = 'image/png';

function sniffImageMime(bytes: Uint8Array): string {
  const match = MIME_SIGNATURES.find((signature) =>
    matchesSignature(bytes, signature)
  );
  return match?.mime ?? FALLBACK_MIME;
}

function bytesToBase64(bytes: Uint8Array): string {
  // Node (and tests) have Buffer; the browser doesn't, so fall back to btoa.
  const maybeBuffer = (
    globalThis as {
      Buffer?: { from(b: Uint8Array): { toString(enc: string): string } };
    }
  ).Buffer;
  if (maybeBuffer) {
    return maybeBuffer.from(bytes).toString('base64');
  }

  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  return btoa(binary);
}

export function imageBytesToDataUrl(bytes: Uint8Array): string {
  return `data:${sniffImageMime(bytes)};base64,${bytesToBase64(bytes)}`;
}
