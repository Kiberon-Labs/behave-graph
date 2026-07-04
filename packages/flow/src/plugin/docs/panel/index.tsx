import { lazy, Suspense } from 'react';
import styles from './styles.module.css';

/**
 * The documentation panel embeds a tiptap/prosemirror editor (~320 KB) to render
 * node markdown. Load it lazily so that weight only enters the bundle when the
 * panel is actually opened.
 */
const LazyPanel = lazy(() =>
  import('./DocumentationBrowserPanelImpl').then((m) => ({
    default: m.DocumentationBrowserPanelImpl
  }))
);

export function DocumentationBrowserPanel() {
  return (
    <Suspense fallback={<div className={styles.container} />}>
      <LazyPanel />
    </Suspense>
  );
}
