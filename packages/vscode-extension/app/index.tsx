import './index.css';
import './lib/vscodeApi'; // Initialize VSCode API singleton early
import React from 'react';
import ReactDOM from 'react-dom/client';
import { MessageHandler } from './lib/messageHandler';
import { initMcpPlugin } from './lib/mcpPlugin';
import {
  SystemProvider,
  System,
  LayoutController,
  GraphRunnerClient,
  UIGraphJSON
} from '@kiberon-labs/behave-graph-flow';
import { kitchenSinkPlugin } from '@kiberon-labs/behave-graph-flow';
import { graphRunnerClientPlugin } from '@kiberon-labs/behave-graph-flow';
import {
  registerCoreProfile,
  writeNodeSpecsToJSON
} from '@kiberon-labs/behave-graph';
import { VSCodeTransport } from './lib/vscodeTransport';
// Expose the libraries so an adjacent `plugin.js` (a no-build classic script
// with no module access) can build registries, nodes and plugins from them.
import * as behaveGraph from '@kiberon-labs/behave-graph';
import * as behaveGraphFlow from '@kiberon-labs/behave-graph-flow';

/** A queued editor plugin contributed by an adjacent `plugin.js`. */
type WebviewPlugin = (system: System) => void | Promise<void>;

declare global {
  interface Window {
    system: System;
    /** React, so a `plugin.tsx` can author controls with JSX (classic runtime). */
    React: typeof React;
    /** The core library, for `plugin.js` authors. */
    behaveGraph: typeof behaveGraph;
    /** The editor (flow) library, for `plugin.js` authors. */
    behaveGraphFlow: typeof behaveGraphFlow;
    /**
     * Queue an editor plugin from a `plugin.js`. The function runs after the
     * editor's own plugins are registered, so it can register controls, custom
     * runners (e.g. the in-browser local runner), and more.
     */
    behaveGraphPlugins?: WebviewPlugin[];
  }
}

// The core profile registers the built-in nodes and value types. Seed the
// System with its specs so the right-click node picker is populated with every
// default node out of the box (the remote runner on the extension host runs the
// matching core profile). A workspace `registry.ts` can extend this on the
// server; the picker still shows the defaults.
const coreRegistry = registerCoreProfile({
  nodes: {},
  values: {},
  dependencies: {} as Parameters<typeof registerCoreProfile>[0]['dependencies']
});

const system = new System({
  values: coreRegistry.values,
  specs: writeNodeSpecsToJSON(coreRegistry)
});
// The extension persists graphs through the VS Code document host (see the
// `getFileData` handler below), not via the editor's default file download, so
// opt out of the built-in download-to-file save handlers.
system.disablePersistence();
// Create the initial graph session and make it active. Per-graph state now
// lives on the session; the editor System holds shared state.
const session = system.createSession('graph');
window.system = system;
window.React = React;
window.behaveGraph = behaveGraph;
window.behaveGraphFlow = behaveGraphFlow;

// Wrapper component to register plugin after GraphRunner is initialized
function App({ system }: { system: System }) {
  return (
    <div id="graph-editor">
      <SystemProvider value={system}>
        <LayoutController />
      </SystemProvider>
    </div>
  );
}

async function initialize() {
  // Create local transport with access to the node registry and store
  const transport = new VSCodeTransport();
  const nexus = new MessageHandler();

  //Overwrite save. Will be called by the document when the user saves, and will trigger a message to VS Code to save the file
  system.hotKeyStore.getState().register({
    action: 'SAVE',
    description: 'Save the current graph',
    trigger: []
  });

  system.pubsub.subscribe('graph:saved', (_, graph) => {
    system.notifications.success('Graph saved successfully');
  });

  nexus.on('init', (message) => {
    if (message.value) {
      const uiGraph = message.value as UIGraphJSON;
      session.graph.deseralize(uiGraph);
      session.flowStore.getState().setGraph(uiGraph.flow, { skipLayout: true });
    }
  });

  // Editor settings resolved from the cascading rc files by the extension host.
  // Apply them, then persist future changes back to the host (which writes the
  // local settings file).
  let settingsPersistenceEnabled = false;
  nexus.on('settings', (merged) => {
    if (merged) system.applySettings(merged);
    if (!settingsPersistenceEnabled) {
      settingsPersistenceEnabled = true;
      system.enableSettingsPersistence({
        getItem: () => null,
        setItem: (_key, value) =>
          nexus.postMessage('saveSettings', JSON.parse(value))
      });
    }
  });

  nexus.on('getFileData', async (_, requestId) => {
    // Serialize the current graph state
    const uiGraph = await session.actionStore.getState().actions.save();
    nexus.postResponse(requestId, {
      value: uiGraph
    });
  });

  nexus.on('graphRunner', (message) => {
    transport.messageListener?.({
      body: message,
      type: 'graphRunner'
    });
  });

  // Surface load-time problems reported by the extension host (a registry.ts /
  // plugin.ts that failed to transpile, a missing workspace transpiler, a
  // registry that failed to import, etc.) as editor toasts, so failures are
  // visible in the graph UI instead of only in the host console.
  nexus.on('notification', (body) => {
    if (!body || typeof body.message !== 'string') return;
    system.notifications.notify(
      body.message,
      body.type ?? 'info',
      body.options
    );
  });

  // Create client with the local transport and message activity tracking
  const client = new GraphRunnerClient({
    transport,
    protocolVersion: '1.0.0',
    auth: { type: 'none' },
    onMessageActivity: (direction, message) => {
      // Access the store from the system after it's registered
      const graphRunnerStore = system.runner.store;
      if (graphRunnerStore) {
        graphRunnerStore.getState().addMessageActivity(direction, message);
      }
    }
  });

  // The standard editor UI plugins (docs, alignment, auto-layout, notes) in one
  // opt-in bundle. Runners are wired separately below (they need host options).
  system.registerPlugin(kitchenSinkPlugin);

  // Register the graph runner plugin. Its loader wires the runner store,
  // toolbar and per-session controllers *synchronously* and only awaits the
  // transport `connect()` at the very end, so capture the promise and let the
  // connection complete in the background. The UI must not wait on a server
  // handshake to paint.
  const runnerReady = system.registerPlugin(graphRunnerClientPlugin, {
    client
  });

  // Register the MCP plugin so the extension host can send tool
  // calls to this webview and plugins can register additional tools.
  system.registerPlugin(initMcpPlugin(nexus));

  // Everything the editor needs to render is now wired synchronously. Paint
  // immediately instead of blocking first paint on the runner's connect().
  render();

  // Ask the host for the graph data + settings straight away. Rendering the
  // nodes needs only the serialized graph (the specs are already registered),
  // not the runner connection below, so this must not wait on `runnerReady`.
  // The host echoes back an `init` message that the handler above deserializes.
  nexus.postMessage('ready');

  // Wait for the runner to finish connecting before running workspace plugins,
  // so a `plugin.js` that swaps the runner sees a fully-initialised one. This
  // happens in the background; the graph is already on screen by now.
  await runnerReady;

  // Run plugins contributed by an adjacent `plugin.js`. They run last, so a
  // plugin can override editor defaults, e.g. swap the remote runner for the
  // in-browser local runner. Failures are logged but don't block the editor.
  for (const contributed of window.behaveGraphPlugins ?? []) {
    try {
      await contributed(system);
    } catch (err) {
      console.error('[behave-graph] plugin.js plugin failed:', err);
    }
  }

  return system;
}

let rendered = false;
function render() {
  if (rendered) return;
  rendered = true;
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App system={system} />
    </React.StrictMode>
  );
}

initialize().catch((err) => {
  console.error('[behave-graph] editor initialization failed:', err);
  // Still paint the editor shell so a connection failure doesn't leave a blank
  // webview.
  render();
});
