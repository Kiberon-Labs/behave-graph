import { plugin } from '@/system/plugin';
import type { System } from '@/system/system';
import { docsPlugin } from '@/plugin/docs';
import { alignmentPlugin } from '@/plugin/alignment';
import { layoutPlugin } from '@/plugin/layout';
import { notesPlugin } from '@/plugin/notes';
import { autosavePlugin } from '@/plugin/autosave';

/**
 * Batteries-included bundle of the standard editor plugins. Register this once
 * instead of wiring each plugin by hand:
 *
 * ```ts
 * const system = new System(registry);
 * system.registerPlugin(kitchenSinkPlugin);
 * ```
 *
 * It currently pulls in:
 * - {@link docsPlugin} — the in-editor node documentation browser;
 * - {@link alignmentPlugin} — node alignment + distribution;
 * - {@link layoutPlugin} — Dagre/ELK auto-layout (heavy deps, opt-in);
 * - {@link notesPlugin} — markdown note nodes (tiptap/prosemirror, opt-in);
 * - {@link autosavePlugin} — client-side local backups of open graphs.
 *
 * It intentionally does **not** register a graph runner: runners
 * ({@link localGraphRunnerPlugin}, the remote client, ...) need host-specific
 * options (a node registry, transport, ...) so hosts wire those themselves.
 */
export const kitchenSinkPlugin = plugin(
  async (system: System) => {
    await system.registerPlugin(docsPlugin);
    await system.registerPlugin(alignmentPlugin);
    await system.registerPlugin(layoutPlugin);
    await system.registerPlugin(notesPlugin);
    await system.registerPlugin(autosavePlugin);
  },
  { name: 'kitchen-sink' }
);
