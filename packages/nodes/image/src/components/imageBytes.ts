/**
 * Shared helpers for turning arbitrary port/output values into displayable
 * image bytes and for sniffing their MIME type. Both the inline node preview
 * (`components/preview/index.tsx`) and the output panel
 * (`components/panels/output.tsx`) render image values that may arrive in a
 * handful of serialized shapes, so these live here rather than being copied
 * into each renderer.
 */

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    typeof value === 'object' && value !== null && value instanceof Uint8Array
  );
}

export function looksLikeUrl(value: string): boolean {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('http:') ||
    value.startsWith('https:')
  );
}

function isNumberArray(value: unknown): value is number[] {
  return Array.isArray(value) && value.every((n) => typeof n === 'number');
}

/** Node.js Buffer structured-clone / JSON shape: `{ type: 'Buffer', data: [] }`. */
function fromBufferJson(value: unknown): Uint8Array | undefined {
  if (
    typeof value !== 'object' ||
    value === null ||
    (value as any).type !== 'Buffer' ||
    !isNumberArray((value as any).data)
  ) {
    return undefined;
  }
  return new Uint8Array((value as any).data);
}

function fromArrayBufferLike(value: unknown): Uint8Array | undefined {
  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }
  return undefined;
}

/** A JSON-stringified number array such as `"[137,80,78,...]"`; URLs are skipped. */
function fromJsonString(value: unknown): Uint8Array | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (looksLikeUrl(trimmed) || !trimmed.startsWith('[')) return undefined;

  try {
    const parsed = JSON.parse(trimmed);
    return isNumberArray(parsed) ? new Uint8Array(parsed) : undefined;
  } catch {
    return undefined;
  }
}

export function tryDeserializeUint8Array(
  value: unknown
): Uint8Array | undefined {
  if (isUint8Array(value)) return value;
  if (isNumberArray(value)) return new Uint8Array(value);

  return (
    fromBufferJson(value) ?? fromArrayBufferLike(value) ?? fromJsonString(value)
  );
}

/**
 * A magic-number signature: a MIME type plus the fixed leading bytes that
 * identify it. `null` slots are wildcard positions (any byte matches), which
 * WebP needs so it can skip the four RIFF size bytes. `alt` lists positions
 * that accept more than one value (GIF's version digit).
 */
interface MimeSignature {
  mime: string;
  bytes: (number | null)[];
  alt?: Record<number, number[]>;
}

const MIME_SIGNATURES: MimeSignature[] = [
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  {
    mime: 'image/png',
    bytes: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]
  },
  // JPEG: FF D8 FF
  { mime: 'image/jpeg', bytes: [0xff, 0xd8, 0xff] },
  // GIF: GIF87a / GIF89a (byte 4 is the version digit)
  {
    mime: 'image/gif',
    bytes: [0x47, 0x49, 0x46, 0x38, 0x37, 0x61],
    alt: { 4: [0x37, 0x39] }
  },
  // WebP: RIFF....WEBP (bytes 4-7 are the RIFF chunk size)
  {
    mime: 'image/webp',
    bytes: [
      0x52,
      0x49,
      0x46,
      0x46,
      null,
      null,
      null,
      null,
      0x57,
      0x45,
      0x42,
      0x50
    ]
  }
];

function matchesSignature(bytes: Uint8Array, sig: MimeSignature): boolean {
  if (bytes.length < sig.bytes.length) return false;
  for (let i = 0; i < sig.bytes.length; i++) {
    const expected = sig.bytes[i];
    if (expected === null) continue;
    const allowed = sig.alt?.[i];
    if (allowed) {
      if (!allowed.includes(bytes[i])) return false;
      continue;
    }
    if (bytes[i] !== expected) return false;
  }
  return true;
}

export function sniffMime(bytes: Uint8Array): string {
  for (const sig of MIME_SIGNATURES) {
    if (matchesSignature(bytes, sig)) return sig.mime;
  }
  // Default to PNG for ImageMagick output in this plugin.
  return 'image/png';
}

export function isBrowserRenderableMime(mime: string): boolean {
  return (
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/gif' ||
    mime === 'image/webp'
  );
}
