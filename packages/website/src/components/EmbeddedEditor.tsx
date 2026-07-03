import React, { Suspense } from 'react';
import type { EmbeddedEditorProps } from './EmbeddedEditorImpl';

// The real editor statically imports the flow package, which touches
// browser-only globals (e.g. CSSStyleSheet) at module load. Deferring it behind
// a dynamic import keeps that code out of Astro's server-side evaluation, so it
// only ever runs in the browser (this island is mounted with `client:only`).
const EmbeddedEditorImpl = React.lazy(() => import('./EmbeddedEditorImpl'));

export default function EmbeddedEditor(props: EmbeddedEditorProps) {
  return (
    <Suspense
      fallback={
        <div
          style={{
            height: props.height ?? '640px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--sl-color-gray-3)'
          }}
        >
          Loading editor…
        </div>
      }
    >
      <EmbeddedEditorImpl {...props} />
    </Suspense>
  );
}
