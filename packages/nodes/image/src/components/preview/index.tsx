import {
  useSystem,
  type Specific,
  type SpecificRenderProps
} from '@kiberon-labs/behave-graph-flow';
import React from 'react';
import { useStore } from 'zustand';

import { ImageMagick, MagickFormat } from '@imagemagick/magick-wasm';
import {
  getPreviewUrl,
  imageSignature,
  setPreviewUrl
} from './previewCache.js';
import {
  isBrowserRenderableMime,
  looksLikeUrl,
  sniffMime,
  tryDeserializeUint8Array
} from '../imageBytes.js';

type ImageNodePreviewProps = SpecificRenderProps & {
  /**
   * When false, ignore the `image.showPreview` setting and always render the
   * preview. Used by the dedicated `image/preview` node so it stays visible
   * even when inline previews are toggled off globally.
   */
  respectSetting?: boolean;
};

const ImageNodePreviewBase: React.FC<ImageNodePreviewProps> = ({
  node,
  respectSetting = true
}) => {
  const system = useSystem();
  const nodeId = node.id;

  // Plugin setting (registered in ui.tsx). Defaults to on when unset. The
  // dedicated preview node opts out of the setting entirely.
  const settingOn = useStore(
    system.systemSettings,
    (s) => s['image.showPreview'] !== false
  );
  const showPreview = respectSetting ? settingOn : true;

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

  React.useEffect(() => {
    if (!nodeId || !showPreview) return;
    const unwatch = system.realtimeRunner.watchNodeOutput(nodeId, 'image');
    return () => unwatch();
  }, [nodeId, showPreview, system.realtimeRunner]);

  React.useEffect(() => {
    let cancelled = false;
    const show = (url: string | undefined) => {
      if (!cancelled) setImageSrc(url);
    };
    const done = () => () => {
      cancelled = true;
    };

    // Previews disabled: clear the image and skip all decode work.
    if (!showPreview) {
      show(undefined);
      return done();
    }

    // Externally-owned URLs (data:/blob:/http:) render directly, uncached.
    if (typeof imageValue === 'string' && looksLikeUrl(imageValue)) {
      show(imageValue);
      return done();
    }

    const bytes = tryDeserializeUint8Array(imageValue);
    if (!bytes || bytes.byteLength === 0) {
      show(undefined);
      return done();
    }

    // Content-addressed cache. React Flow culls off-screen nodes, so a node that
    // scrolls back into view remounts and reuses its cached blob URL here instead
    // of re-decoding and re-creating one — the object URL's lifetime is owned by
    // the cache, not by this component's mount/unmount.
    const key = imageSignature(bytes);
    const cached = getPreviewUrl(key);
    if (cached !== undefined) {
      show(cached);
      return done();
    }

    const blobBytes = new Uint8Array(bytes.byteLength);
    blobBytes.set(bytes);

    const detectedMime = sniffMime(blobBytes);
    if (isBrowserRenderableMime(detectedMime)) {
      const url = URL.createObjectURL(
        new Blob([blobBytes], { type: detectedMime })
      );
      setPreviewUrl(key, url);
      show(url);
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
            setPreviewUrl(key, url);
            show(url);
          } finally {
            image.dispose();
          }
        });
      });
    }

    return done();
  }, [imageValue, showPreview]);

  if (!showPreview || !imageSrc) return null;

  return (
    <div
      style={{
        padding:
          '0 var(--component-spacing-sm, 8px) var(--component-spacing-sm, 8px)'
      }}
    >
      <div
        style={{
          overflow: 'hidden',
          borderRadius: 'var(--component-radii-sm, 4px)',
          border: '1px solid var(--ds-panel-border, #2b2b2b)'
        }}
      >
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
          draggable={false}
        />
      </div>
    </div>
  );
};

/** Inline preview that respects the `image.showPreview` toggle. */
const ImageNodePreview: React.FC<SpecificRenderProps> = (props) => (
  <ImageNodePreviewBase {...props} respectSetting />
);

/** Inline preview that is always shown, regardless of the toggle. */
const AlwaysImageNodePreview: React.FC<SpecificRenderProps> = (props) => (
  <ImageNodePreviewBase {...props} respectSetting={false} />
);

const producesImageOutput = (spec: {
  outputs?: { name: string; valueType: string }[];
}) =>
  spec.outputs?.some(
    (socket) => socket.name === 'image' && socket.valueType === 'image'
  ) ?? false;

export const imagePreviewSpecific: Specific = {
  name: 'imagePreview',
  // Match any node that produces an `image` output , value-type coupling, not a
  // node-type prefix , so image-producing nodes from other packages (e.g. the
  // AI package's `ai/generateImage`) get the inline preview too. The renderer
  // watches the `image` output, so require a socket of that exact name + type.
  //
  // The dedicated `image/preview` node is excluded here and handled by
  // `imageAlwaysPreviewSpecific` below, so it never renders two previews.
  check: (spec) => spec.type !== 'image/preview' && producesImageOutput(spec),
  render: ImageNodePreview
};

export const imageAlwaysPreviewSpecific: Specific = {
  name: 'imageAlwaysPreview',
  // Only the dedicated preview node, which always shows its preview.
  check: (spec) => spec.type === 'image/preview',
  render: AlwaysImageNodePreview
};
