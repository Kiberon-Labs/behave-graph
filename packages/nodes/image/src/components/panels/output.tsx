import { useSystem } from '@kiberon-labs/behave-graph-flow';
import React from 'react';
import { useStore } from 'zustand';

import { ImageMagick, MagickFormat } from '@imagemagick/magick-wasm';

function isUint8Array(value: unknown): value is Uint8Array {
  return (
    typeof value === 'object' && value !== null && value instanceof Uint8Array
  );
}

function looksLikeUrl(value: string): boolean {
  return (
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    value.startsWith('http:') ||
    value.startsWith('https:')
  );
}

function tryDeserializeUint8Array(value: unknown): Uint8Array | undefined {
  if (isUint8Array(value)) return value;

  // Node.js Buffer structured-clone / JSON shape
  if (
    typeof value === 'object' &&
    value !== null &&
    (value as any).type === 'Buffer' &&
    Array.isArray((value as any).data)
  ) {
    const data = (value as any).data;
    if (data.every((n: any) => typeof n === 'number')) {
      return new Uint8Array(data);
    }
  }

  if (value instanceof ArrayBuffer) return new Uint8Array(value);
  if (ArrayBuffer.isView(value)) {
    const view = value as ArrayBufferView;
    return new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (looksLikeUrl(trimmed)) return undefined;
    if (!trimmed.startsWith('[')) return undefined;

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed) && parsed.every((n) => typeof n === 'number')) {
        return new Uint8Array(parsed);
      }
    } catch {
      return undefined;
    }
  }

  if (Array.isArray(value) && value.every((n) => typeof n === 'number')) {
    return new Uint8Array(value);
  }

  return undefined;
}

function sniffMime(bytes: Uint8Array): string {
  // PNG: 89 50 4E 47 0D 0A 1A 0A
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47 &&
    bytes[4] === 0x0d &&
    bytes[5] === 0x0a &&
    bytes[6] === 0x1a &&
    bytes[7] === 0x0a
  ) {
    return 'image/png';
  }

  // JPEG: FF D8 FF
  if (
    bytes.length >= 3 &&
    bytes[0] === 0xff &&
    bytes[1] === 0xd8 &&
    bytes[2] === 0xff
  ) {
    return 'image/jpeg';
  }

  // GIF: GIF87a / GIF89a
  if (
    bytes.length >= 6 &&
    bytes[0] === 0x47 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x38 &&
    (bytes[4] === 0x37 || bytes[4] === 0x39) &&
    bytes[5] === 0x61
  ) {
    return 'image/gif';
  }

  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp';
  }

  // Default to PNG for ImageMagick output in this plugin.
  return 'image/png';
}

function isBrowserRenderableMime(mime: string): boolean {
  return (
    mime === 'image/png' ||
    mime === 'image/jpeg' ||
    mime === 'image/gif' ||
    mime === 'image/webp'
  );
}

export const ImageOutputPanel: React.FC = () => {
  const system = useSystem();

  const nodes = useStore(system.nodeStore, (s) => s.nodes);

  const outputNodeId = React.useMemo(() => {
    const node = nodes.find(
      (n: any) => n?.type === 'behaveNode' && n?.data?.type === 'output/image'
    );
    return node?.id as string | undefined;
  }, [nodes]);

  const imageValue = useStore(system.realtimeRunner.store, (s) =>
    outputNodeId ? (s.outputs[outputNodeId]?.image as unknown) : undefined
  );

  const [imageSrc, setImageSrc] = React.useState<string | undefined>(undefined);
  const [imageSize, setImageSize] = React.useState<
    { width: number; height: number } | undefined
  >(undefined);

  const [zoom, setZoom] = React.useState(1);
  const [pan, setPan] = React.useState({ x: 0, y: 0 });
  const [isPanning, setIsPanning] = React.useState(false);
  const panStartRef = React.useRef<
    | {
        pointerId: number;
        startClientX: number;
        startClientY: number;
        startPanX: number;
        startPanY: number;
      }
    | undefined
  >(undefined);

  const clampZoom = React.useCallback((value: number) => {
    const min = 0.1;
    const max = 8;
    return Math.min(max, Math.max(min, value));
  }, []);

  const zoomIn = React.useCallback(() => {
    setZoom((z) => clampZoom(z * 1.25));
  }, [clampZoom]);

  const zoomOut = React.useCallback(() => {
    setZoom((z) => clampZoom(z / 1.25));
  }, [clampZoom]);

  const zoomReset = React.useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const objectUrlRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    return () => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = undefined;
      }
    };
  }, []);

  React.useEffect(() => {
    let cancelled = false;

    const setDirectUrl = (url: string) => {
      if (objectUrlRef.current) {
        URL.revokeObjectURL(objectUrlRef.current);
        objectUrlRef.current = undefined;
      }
      setImageSrc(url);
    };

    const setObjectUrl = (url: string) => {
      if (cancelled) {
        URL.revokeObjectURL(url);
        return;
      }
      const prev = objectUrlRef.current;
      objectUrlRef.current = url;
      setImageSrc(url);
      if (prev && prev !== url) URL.revokeObjectURL(prev);
    };

    if (typeof imageValue === 'string' && looksLikeUrl(imageValue)) {
      setDirectUrl(imageValue);
      return () => {
        cancelled = true;
      };
    }

    const bytes = tryDeserializeUint8Array(imageValue);
    if (!bytes || bytes.byteLength === 0) {
      setDirectUrl('');
      setImageSrc(undefined);
      return () => {
        cancelled = true;
      };
    }

    const blobBytes = new Uint8Array(bytes.byteLength);
    blobBytes.set(bytes);

    const detectedMime = sniffMime(blobBytes);
    if (isBrowserRenderableMime(detectedMime)) {
      const url = URL.createObjectURL(
        new Blob([blobBytes], { type: detectedMime })
      );
      setObjectUrl(url);
    } else {
      // If ImageMagick produced a non-browser-native format, convert to PNG for display.
      ImageMagick.read(blobBytes, (image) => {
        image.write(MagickFormat.Png, (pngBytes) => {
          try {
            const safePngBytes = new Uint8Array(pngBytes.byteLength);
            safePngBytes.set(pngBytes);
            const url = URL.createObjectURL(
              new Blob([safePngBytes], { type: 'image/png' })
            );
            setObjectUrl(url);
          } finally {
            image.dispose();
          }
        });
      });
    }

    return () => {
      cancelled = true;
    };
  }, [imageValue]);

  React.useEffect(() => {
    // Reset aspect ratio when the image changes.
    setImageSize(undefined);
    setPan({ x: 0, y: 0 });
    setIsPanning(false);
    panStartRef.current = undefined;
  }, [imageSrc]);

  React.useEffect(() => {
    if (!outputNodeId) return;
    const unwatch = system.realtimeRunner.watchNodeOutput(
      outputNodeId,
      'image'
    );
    return () => unwatch();
  }, [outputNodeId, system.realtimeRunner]);

  return (
    <div className="flex h-full w-full flex-col p-2">
      <div className="flex items-center gap-2 pb-2">
        <button
          type="button"
          className="rounded border border-gray-700 px-2 py-1 text-xs"
          onClick={zoomOut}
          aria-label="Zoom out"
        >
          -
        </button>
        <button
          type="button"
          className="rounded border border-gray-700 px-2 py-1 text-xs"
          onClick={zoomReset}
          aria-label="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <button
          type="button"
          className="rounded border border-gray-700 px-2 py-1 text-xs"
          onClick={zoomIn}
          aria-label="Zoom in"
        >
          +
        </button>
      </div>
      <div className="flex-1 overflow-hidden">
        {outputNodeId && imageSrc ? (
          <div
            className="h-full w-full"
            style={{
              touchAction: 'none',
              cursor: isPanning ? 'grabbing' : 'grab'
            }}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              (e.currentTarget as HTMLDivElement).setPointerCapture(
                e.pointerId
              );
              panStartRef.current = {
                pointerId: e.pointerId,
                startClientX: e.clientX,
                startClientY: e.clientY,
                startPanX: pan.x,
                startPanY: pan.y
              };
              setIsPanning(true);
            }}
            onWheel={(e) => {
              // Zoom only when user intends it; keep normal scrolling otherwise.
              e.preventDefault();
              const direction = Math.sign(e.deltaY);
              const factor = direction > 0 ? 1 / 1.1 : 1.1;
              setZoom((z) => clampZoom(z * factor));
            }}
            onPointerMove={(e) => {
              const start = panStartRef.current;
              if (!start || start.pointerId !== e.pointerId) return;
              e.preventDefault();
              setPan({
                x: start.startPanX + (e.clientX - start.startClientX),
                y: start.startPanY + (e.clientY - start.startClientY)
              });
            }}
            onPointerUp={(e) => {
              const start = panStartRef.current;
              if (!start || start.pointerId !== e.pointerId) return;
              e.preventDefault();
              panStartRef.current = undefined;
              setIsPanning(false);
            }}
            onPointerCancel={(e) => {
              const start = panStartRef.current;
              if (!start || start.pointerId !== e.pointerId) return;
              e.preventDefault();
              panStartRef.current = undefined;
              setIsPanning(false);
            }}
          >
            <div
              className="inline-block rounded overflow-hidden border border-gray-700"
              style={{
                transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
                transformOrigin: 'top left'
              }}
            >
              <img
                src={imageSrc}
                alt="output"
                className="block"
                draggable={false}
                style={
                  imageSize
                    ? {
                        width: imageSize.width,
                        height: imageSize.height,
                        pointerEvents: 'none'
                      }
                    : { pointerEvents: 'none' }
                }
                onLoad={(e) => {
                  const img = e.currentTarget;
                  if (img.naturalWidth > 0 && img.naturalHeight > 0) {
                    setImageSize({
                      width: img.naturalWidth,
                      height: img.naturalHeight
                    });
                  }
                }}
              />
            </div>
          </div>
        ) : (
          <div className="text-sm opacity-70">No output image available.</div>
        )}
      </div>
    </div>
  );
};
