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
import { docsPlugin } from '@kiberon-labs/behave-graph-flow';
import { graphRunnerClientPlugin } from '@kiberon-labs/behave-graph-flow';
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

const system = new System();
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

  system.registerPlugin(docsPlugin);
  await system.registerPlugin(graphRunnerClientPlugin, {
    client
  });

  // Register the MCP plugin so the extension host can send tool
  // calls to this webview and plugins can register additional tools.
  system.registerPlugin(initMcpPlugin(nexus));

  // Run plugins contributed by an adjacent `plugin.js`. They run last, so a
  // plugin can override editor defaults — e.g. swap the remote runner for the
  // in-browser local runner. Failures are logged but don't block the editor.
  for (const contributed of window.behaveGraphPlugins ?? []) {
    try {
      await contributed(system);
    } catch (err) {
      console.error('[behave-graph] plugin.js plugin failed:', err);
    }
  }

  nexus.postMessage('ready');

  return system;
}

// Initialize and render
initialize().then((system) => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App system={system} />
    </React.StrictMode>
  );
});
