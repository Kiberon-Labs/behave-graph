import type { LayoutBase } from 'rc-dock';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import type { UIGraphJSON } from '@/types/graph';
import { downloadJson } from '@/util/downloadJson';
import type { System } from './system';

/**
 * Sinks invoked when the editor emits its save events. Each entry maps one
 * editor-level pubsub topic to the side effect that persists it (write the JSON
 * somewhere). Override any subset to redirect where saved data goes; sinks left
 * unspecified keep the built-in file-download behaviour.
 *
 * Loading is not represented here: the menubar's "Load" items already read a
 * file from disk and deserialize it into the focused graph by default, so there
 * is nothing host-specific to wire for the common case.
 */
export interface PersistenceAdapter {
  /** Persist a full UI graph save (`graph:saved`). */
  saveGraph: (graph: UIGraphJSON) => void;
  /** Persist a raw inner behave-graph save (`graph:inner:saved`). */
  saveInnerGraph: (graph: GraphJSON) => void;
  /** Persist a dock layout save (`layout:saved`). */
  saveLayout: (layout: LayoutBase) => void;
}

/**
 * Whether the file-download default can run. Guards the built-in sinks so that
 * constructing a `System` in a non-DOM context (tests, SSR, the compiler) never
 * throws , the subscriptions are harmless, only the download body is skipped.
 */
const canDownload = (): boolean =>
  typeof document !== 'undefined' && typeof URL !== 'undefined';

/**
 * The built-in persistence: saving triggers a browser download of the
 * corresponding JSON file. This is the default so a freshly constructed editor
 * has working Save actions without any per-host or per-story wiring.
 */
export const defaultPersistenceAdapter: PersistenceAdapter = {
  saveGraph: (graph) => {
    if (canDownload()) downloadJson('graph.json', graph);
  },
  saveInnerGraph: (graph) => {
    if (canDownload()) downloadJson('graph.behave.json', graph);
  },
  saveLayout: (layout) => {
    if (canDownload()) downloadJson('layout.json', layout);
  }
};

/**
 * Subscribe the given (or default) persistence sinks to the editor's save
 * topics. Any sink not provided falls back to {@link defaultPersistenceAdapter}.
 * Returns a disposer that removes every subscription it added.
 */
export function installPersistence(
  system: System,
  adapter: Partial<PersistenceAdapter> = {}
): () => void {
  const resolved: PersistenceAdapter = {
    ...defaultPersistenceAdapter,
    ...adapter
  };

  const tokens = [
    system.pubsub.subscribe('graph:saved', (_, graph) =>
      resolved.saveGraph(graph)
    ),
    system.pubsub.subscribe('graph:inner:saved', (_, graph) =>
      resolved.saveInnerGraph(graph)
    ),
    system.pubsub.subscribe('layout:saved', (_, layout) =>
      resolved.saveLayout(layout)
    )
  ];

  return () => {
    for (const token of tokens) {
      if (typeof token === 'string') system.pubsub.unsubscribe(token);
    }
  };
}
