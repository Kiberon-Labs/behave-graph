/**
 * Short-term, content-addressed cache of decoded preview object URLs.
 *
 * React Flow (the node canvas) culls off-screen nodes, so zooming and panning
 * mount and unmount node previews constantly. Without a cache, every mount
 * re-decodes the image bytes and calls `URL.createObjectURL`, and every unmount
 * revokes it — that churn stalls the scroll/zoom experience.
 *
 * This cache decouples the blob URL's lifetime from the React mount lifetime:
 * URLs are keyed by image content and held in a small LRU, so a node that
 * remounts reuses the existing blob instead of rebuilding it. Entries are
 * revoked only when evicted, not when a component unmounts.
 */

// Fast per-reference signature memo. The preview value usually comes straight
// from the runner store, so the same `Uint8Array` reference recurs across
// remounts and resolves here in O(1) without rehashing.
const signatureByRef = new WeakMap<object, string>();

/**
 * Cheap content fingerprint (sampled FNV-1a + length). Two buffers with the same
 * signature are treated as the same image for preview purposes.
 */
export const imageSignature = (bytes: Uint8Array): string => {
  const cached = signatureByRef.get(bytes);
  if (cached !== undefined) return cached;

  const len = bytes.length;
  // Sample at most ~2048 bytes so fingerprinting a large image stays cheap.
  const step = len > 4096 ? Math.floor(len / 2048) : 1;
  let hash = 0x811c9dc5;
  for (let i = 0; i < len; i += step) {
    hash ^= bytes[i];
    hash = Math.imul(hash, 0x01000193);
  }
  const sig = `${(hash >>> 0).toString(16)}:${len}`;
  signatureByRef.set(bytes, sig);
  return sig;
};

const MAX_ENTRIES = 128;
// Insertion-ordered map used as an LRU: re-inserting on access marks an entry as
// most-recently used, so the oldest key is always `keys().next()`.
const urlByKey = new Map<string, string>();

/** Return a cached preview URL for `key`, marking it most-recently-used. */
export const getPreviewUrl = (key: string): string | undefined => {
  const url = urlByKey.get(key);
  if (url === undefined) return undefined;
  urlByKey.delete(key);
  urlByKey.set(key, url);
  return url;
};

/**
 * Store a freshly created object URL for `key`, evicting (and revoking) the
 * least-recently-used entries once the cache is full.
 */
export const setPreviewUrl = (key: string, url: string): void => {
  const existing = urlByKey.get(key);
  if (existing !== undefined) {
    if (existing === url) return;
    URL.revokeObjectURL(existing);
    urlByKey.delete(key);
  }
  urlByKey.set(key, url);

  while (urlByKey.size > MAX_ENTRIES) {
    const oldest = urlByKey.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    const oldUrl = urlByKey.get(oldest);
    if (oldUrl !== undefined) URL.revokeObjectURL(oldUrl);
    urlByKey.delete(oldest);
  }
};
