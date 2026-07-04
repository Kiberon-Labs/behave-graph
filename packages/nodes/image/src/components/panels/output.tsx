import { Icon, useSystem } from '@kiberon-labs/behave-graph-flow';
import { MediaImage, ZoomIn, ZoomOut } from 'iconoir-react';
import React from 'react';
import { useStore } from 'zustand';

import { ImageMagick, MagickFormat } from '@imagemagick/magick-wasm';
import {
  isBrowserRenderableMime,
  looksLikeUrl,
  sniffMime,
  tryDeserializeUint8Array
} from '../imageBytes.js';

/**
 * Styles use the editor's `--ds-*` design tokens inline rather than a CSS
 * module: this package's build does not transform CSS modules, so inline styles
 * are what actually reach the editor. Colors resolve against the host theme at
 * runtime. Icon buttons come from the shared flow `Icon` primitive, whose own
 * styling ships with the flow package.
 */
const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'flex',
    flexDirection: 'column',
    height: '100%',
    width: '100%',
    overflow: 'hidden',
    backgroundColor: 'var(--ds-tab-inactive-bg, #181818)',
    color: 'var(--ds-editor-fg, #cccccc)'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    gap: 'var(--component-spacing-xs, 4px)',
    padding:
      'var(--component-spacing-xs, 4px) var(--component-spacing-sm, 8px)',
    borderBottom: '1px solid var(--ds-panel-border, #2b2b2b)',
    flexShrink: 0
  },
  zoomLabel: {
    minWidth: '3.25em',
    padding: '2px var(--component-spacing-xs, 4px)',
    font: 'inherit',
    fontSize: '0.85em',
    textAlign: 'center',
    color: 'var(--ds-fg-muted, #cccccc)',
    background: 'transparent',
    border: 'none',
    borderRadius: 'var(--component-radii-sm, 4px)',
    cursor: 'pointer'
  },
  viewport: {
    position: 'relative',
    flex: 1,
    minHeight: 0,
    overflow: 'hidden'
  },
  stage: {
    height: '100%',
    width: '100%',
    touchAction: 'none'
  },
  frame: {
    display: 'inline-block',
    overflow: 'hidden',
    border: '1px solid var(--ds-panel-border, #2b2b2b)',
    borderRadius: 'var(--component-radii-sm, 4px)',
    transformOrigin: 'top left'
  },
  image: {
    display: 'block'
  },
  empty: {
    display: 'flex',
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 'var(--component-spacing-sm, 8px)',
    height: '100%',
    padding: 'var(--component-spacing-md, 12px)',
    textAlign: 'center',
    color: 'var(--ds-fg-muted, #cccccc)'
  },
  emptyIcon: {
    opacity: 0.5
  },
  emptyText: {
    fontSize: '0.9em',
    opacity: 0.8
  }
};

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

  // No image: show a centered empty state and hide the zoom toolbar entirely.
  if (!outputNodeId || !imageSrc) {
    return (
      <div style={styles.root}>
        <div style={styles.empty}>
          <MediaImage width={28} height={28} style={styles.emptyIcon} />
          <span style={styles.emptyText}>No output image available.</span>
        </div>
      </div>
    );
  }

  return (
    <div style={styles.root}>
      <div style={styles.toolbar}>
        <Icon title="Zoom out" onClick={zoomOut}>
          <ZoomOut width={16} height={16} />
        </Icon>
        <button
          type="button"
          style={styles.zoomLabel}
          onClick={zoomReset}
          title="Reset zoom"
        >
          {Math.round(zoom * 100)}%
        </button>
        <Icon title="Zoom in" onClick={zoomIn}>
          <ZoomIn width={16} height={16} />
        </Icon>
      </div>
      <div style={styles.viewport}>
        <div
          style={{ ...styles.stage, cursor: isPanning ? 'grabbing' : 'grab' }}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            (e.currentTarget as HTMLDivElement).setPointerCapture(e.pointerId);
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
            style={{
              ...styles.frame,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`
            }}
          >
            <img
              src={imageSrc}
              alt="output"
              draggable={false}
              style={
                imageSize
                  ? {
                      ...styles.image,
                      width: imageSize.width,
                      height: imageSize.height,
                      pointerEvents: 'none'
                    }
                  : { ...styles.image, pointerEvents: 'none' }
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
      </div>
    </div>
  );
};
