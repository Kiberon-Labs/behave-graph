import React, { useMemo } from 'react';
// Pulls in reactflow, rc-menu, rc-dock (dark) and the editor's own styles.
import '@kiberon-labs/behave-graph-flow/entry.css';
// The Kiberon Labs theme's `--ds-font-ui` / `--ds-font-mono` ask for Geist;
// self-host it (variable fonts) so the editor renders in the brand typeface.
import '@fontsource-variable/geist';
import '@fontsource-variable/geist-mono';
import {
  System,
  SystemProvider,
  GraphProvider,
  LayoutController,
  kitchenSinkPlugin,
  localGraphRunnerPlugin,
  type GraphSession
} from '@kiberon-labs/behave-graph-flow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';

/**
 * A small starter graph so the canvas is not empty on first load: an onStart
 * event flowing into a branch that logs one of two messages. Users can edit,
 * add nodes via the right-click picker, and hit Run in the Local Graph Runner.
 */
const STARTER_GRAPH = {
  nodes: [
    {
      type: 'lifecycle/onStart',
      id: '0',
      flows: { flow: { nodeId: '1', socket: 'flow' } }
    },
    {
      type: 'flow/branch',
      id: '1',
      parameters: { condition: { value: true } },
      flows: {
        true: { nodeId: '2', socket: 'flow' },
        false: { nodeId: '3', socket: 'flow' }
      }
    },
    {
      type: 'debug/log',
      id: '2',
      parameters: { text: { value: 'Condition is true!' } }
    },
    {
      type: 'debug/log',
      id: '3',
      parameters: { text: { value: 'Condition is false!' } }
    }
  ]
} as const;

/**
 * Build a fully wired editor: the core profile registers the built-in nodes and
 * value types, the kitchen-sink plugin adds the batteries-included editor UI,
 * and the local graph runner lets the graph execute in-browser (Run button).
 *
 * Created once and memoized so remounts (e.g. React StrictMode in dev) reuse
 * the same System and its stores.
 */
let cachedEditor: { system: System; session: GraphSession } | undefined;

function getEditor() {
  if (cachedEditor) return cachedEditor;

  const coreRegistry = registerCoreProfile({
    nodes: {},
    values: {},
    dependencies: {} as Parameters<
      typeof registerCoreProfile
    >[0]['dependencies']
  });

  // The node picker reads specs from the System; populate them from the
  // registry so users can add every core node from the right-click menu.
  const system = new System({
    values: coreRegistry.values,
    specs: writeNodeSpecsToJSON(coreRegistry)
  });
  const session = system.createSession('graph');

  system.registerPlugin(kitchenSinkPlugin);
  system.registerPlugin(localGraphRunnerPlugin, { registry: coreRegistry });

  session.flowStore.getState().setGraph(STARTER_GRAPH);

  cachedEditor = { system, session };
  return cachedEditor;
}

export interface EmbeddedEditorProps {
  /** CSS height for the editor frame. Defaults to a comfortable 640px. */
  height?: string;
  /**
   * Draw a rounded border around the frame. Defaults to `true` for the inline
   * docs embed; pass `false` for the edge-to-edge full-page editor.
   */
  bordered?: boolean;
}

/**
 * The full Behave Graph editor (menubar, dockable panels, logs and an
 * in-browser Run button) embedded as an interactive island. Mount with
 * `client:only="react"` from an Astro / MDX page.
 */
export default function EmbeddedEditor({
  height = '640px',
  bordered = true
}: EmbeddedEditorProps) {
  const { system, session } = useMemo(() => getEditor(), []);

  // `@fontsource-variable/geist` registers the families as "Geist Variable" /
  // "Geist Mono Variable", so point the theme's font tokens at those exact
  // names (the Kiberon theme itself asks for a plain "Geist"). Setting a base
  // `fontFamily` too makes editor chrome that merely inherits its font (e.g.
  // rc-dock tabs) render in Geist instead of the browser's serif default.
  const frameStyle: React.CSSProperties & Record<string, string> = {
    height,
    width: '100%',
    border: bordered ? '1px solid var(--sl-color-gray-5)' : 'none',
    borderRadius: bordered ? '0.5rem' : '0',
    overflow: 'hidden',
    '--ds-font-ui':
      '"Geist Variable", "Inter", system-ui, -apple-system, sans-serif',
    '--ds-font-mono':
      '"Geist Mono Variable", "SF Mono", ui-monospace, monospace',
    fontFamily: 'var(--ds-font-ui)'
  };

  return (
    <div
      className="not-content"
      // Activate the flow package's opt-in Kiberon Labs theme (re-themes the
      // editor via its scoped `--ds-*` tokens and switches to the Geist stack).
      data-flow-theme="kiberon"
      style={frameStyle}
    >
      <SystemProvider value={system}>
        <GraphProvider value={session}>
          <LayoutController />
        </GraphProvider>
      </SystemProvider>
    </div>
  );
}
