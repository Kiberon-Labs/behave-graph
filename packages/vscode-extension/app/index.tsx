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

declare global {
  interface Window {
    system: System;
  }
}

const system = new System();
window.system = system;

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
      system.graph.deseralize(uiGraph);
      system.flowStore.getState().setGraph(uiGraph.flow, { skipLayout: true });
    }
  });

  nexus.on('getFileData', async (_, requestId) => {
    // Serialize the current graph state
    const uiGraph = await system.actionStore.getState().actions.save();
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
