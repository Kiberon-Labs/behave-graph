import {
  useSystem,
  type Specific,
  type SpecificRenderProps
} from '@kiberon-labs/behave-graph-flow';
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

export const ImageNodePreview: React.FC<SpecificRenderProps> = ({ node }) => {
  const system = useSystem();
  const nodeId = node.id;

  // Plugin setting (registered in ui.tsx). Defaults to on when unset.
  const showPreview = useStore(
    system.systemSettings,
    (s) => s['image.showPreview'] !== false
  );

  const edges = useStore(system.edgeStore, (s) => s.edges);
  const imageSocketConnected = React.useMemo(() => {
    if (!nodeId) return false;
    return (edges ?? []).some(
      (e: any) =>
        (e?.target === nodeId && e?.targetHandle === 'image') ||
        (e?.source === nodeId && e?.sourceHandle === 'image')
    );
  }, [edges, nodeId]);

  const liveImageValue = useStore(
    system.realtimeRunner.store,
    (s) => s.outputs[nodeId]?.image
  );

  const portImageValue = (node as any)?.data?.ports?.image;
  const imageValue = imageSocketConnected
    ? (liveImageValue ?? portImageValue)
    : (portImageValue ?? liveImageValue);

  const [imageSrc, setImageSrc] = React.useState<string | undefined>(undefined);
  const objectUrlRef = React.useRef<string | undefined>(undefined);

  React.useEffect(() => {
    if (!nodeId || !showPreview) return;
    const unwatch = system.realtimeRunner.watchNodeOutput(nodeId, 'image');
    return () => unwatch();
  }, [nodeId, showPreview, system.realtimeRunner]);

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

    const setDirectUrl = (url: string | undefined) => {
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

    // Previews disabled: clear any current image and skip the decode work.
    if (!showPreview) {
      setDirectUrl(undefined);
      return () => {
        cancelled = true;
      };
    }

    if (typeof imageValue === 'string' && looksLikeUrl(imageValue)) {
      setDirectUrl(imageValue);
      return () => {
        cancelled = true;
      };
    }

    const bytes = tryDeserializeUint8Array(imageValue);
    if (!bytes || bytes.byteLength === 0) {
      setDirectUrl(undefined);
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
      ImageMagick.read(blobBytes, (image) => {
        const target = MagickFormat.Png;

        image.write(target, (pngBytes) => {
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
  }, [imageValue, showPreview]);

  if (!showPreview || !imageSrc) return null;

  return (
    <div className="px-2 pb-2">
      <div className="rounded overflow-hidden border border-gray-700">
        <img
          src={imageSrc}
          alt="preview"
          style={{
            maxWidth: '150px',
            width: '100%',
            height: 'auto',
            display: 'block',
            objectFit: 'contain'
          }}
          className="block w-full h-auto"
          draggable={false}
        />
      </div>
    </div>
  );
};

export const imagePreviewSpecific: Specific = {
  name: 'imagePreview',
  // Match any node that produces an `image` output , value-type coupling, not a
  // node-type prefix , so image-producing nodes from other packages (e.g. the
  // AI package's `ai/generateImage`) get the inline preview too. The renderer
  // watches the `image` output, so require a socket of that exact name + type.
  check: (spec) =>
    spec.outputs?.some(
      (socket) => socket.name === 'image' && socket.valueType === 'image'
    ) ?? false,
  render: ImageNodePreview
};
