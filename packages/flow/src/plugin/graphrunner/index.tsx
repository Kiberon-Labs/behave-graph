/**
 * WebSocket client plugin for the Behave-Graph Execution Protocol
 * Provides UI and store integration for remote graph execution
 */

import { type System } from '../../system/system';
import { graphRunnerClientStoreFactory } from './store';
import { GraphRunnerClient } from './client';
import { GraphRunnerPanel } from './panel';
import { ErrorBoundary } from 'react-error-boundary';
import { MenuItemElement } from '../../components/menubar/menuItem';
import type { StoreApi } from 'zustand';
import type { GraphRunnerClientStore } from './store';
import { GraphRunnerButtons } from './buttons';
import { plugin } from '@/system/plugin';
import { GraphRunner } from './runner';
import { GraphRunController } from './runController';
import type { GraphSession } from '@/system/graphSession';

export * from './types';
export * from './client';
export * from './transport';
export * from './panel';
export * from './runner';
export * from './runController';
export * from './store';
export * from './session';
/**
 * Options for the GraphRunner plugin
 */
export interface GraphRunnerClientPluginOptions {
  /**
   * Preconfigured GraphRunner client instance.
   * If provided, the plugin will use this client instead of creating a new one.
   * Useful when the client is already connected via a custom transport (e.g., VSCode IPC).
   */
  client?: GraphRunnerClient;

  /**
   * Preconfigured store instance.
   * If provided, the plugin will use this store instead of creating a new one.
   * Useful for sharing state with external components.
   */
  store?: StoreApi<GraphRunnerClientStore>;

  /**
   * Whether to skip automatic connection.
   * Default: false (will attempt to connect if client is not provided or not connected)
   */
  skipAutoConnect?: boolean;

  /**
   * Whether to add the menu item to the Window menu.
   * Default: true
   */
  addMenuItem?: boolean;
}

/**
 * Plugin initialization function
 * Registers the GraphRunnerClient store and actions with the system
 */
export async function graphRunnerClientPluginLoader(
  system: System,
  options: GraphRunnerClientPluginOptions = {}
) {
  // Use provided store or create a new one
  const store = options.store ?? graphRunnerClientStoreFactory(system);

  // If a preconfigured client is provided, set it in the store
  if (options.client) {
    store.getState().setClient(options.client);

    // If client is already connected, update connection state
    if (options.client.isConnected()) {
      store.getState().setConnectionState('connected');

      // Populate connection info if available
      const connectionInfo = {
        serverId: options.client.getServerId(),
        userId: options.client.getUserId(),
        authenticated: options.client.isAuthenticated(),
        capabilities: options.client.getCachedCapabilities(),
        sessionId: null // Session management is external when client is provided
      };
      store.getState().setConnectionInfo(connectionInfo);
    }
  }

  // Shared connection. Per-session run controllers are created below.
  const runner = new GraphRunner(system, store);
  system.decorate('runner', runner);

  // Attach a run controller to every graph session (existing + future) so each
  // open graph runs independently over the shared connection. The editor applies
  // this to graphs already open and to every graph created later, and tears the
  // controller down when a graph's tab is closed.
  system.registerSessionExtension((session: GraphSession) => {
    if (!session.runController) {
      session.decorate(
        'runController',
        new GraphRunController(session, runner)
      );
    }
    return () => {
      session.runController?.dispose();
      session.decorate('runController', undefined);
    };
  });

  // Add toolbar buttons for graph execution control. Rendered inside each graph
  // tab, GraphRunnerButtons resolves its own session's controller.
  system.toolbarStore.getState().addGroup({
    id: 'graph-runner-controls',
    label: 'Graph Runner',
    buttons: [<GraphRunnerButtons key="graph-runner-buttons" />]
  });

  system.hotKeyStore.getState().register({
    action: 'PLAY',
    description: 'Triggers playing the graph',
    trigger: 'p',
    handler: () => {
      const controller = system.session?.runController;
      if (!controller) return;
      if (controller.store.getState().isExecuting) {
        controller.stop();
      } else {
        controller.play();
      }
    }
  });

  // Register the panel with TabLoader
  system.tabLoader.register('graphRunner', () => {
    return {
      id: 'graphRunner',
      closable: true,
      title: 'Remote Graph Runner',
      group: 'default',
      content: () => (
        <ErrorBoundary fallback={'Error loading Graph Runner panel'}>
          <GraphRunnerPanel system={system} />
        </ErrorBoundary>
      )
    };
  });

  // Add menu item to Window menu (unless disabled)
  if (options.addMenuItem !== false) {
    const menuStore = system.menubarStore;
    const currentItems = menuStore.getState().items;
    const windowMenu = currentItems.find((menu) => menu.name === 'window');

    if (windowMenu) {
      // Add the Graph Runner menu item to the Window menu
      const newMenuItem = {
        name: 'graphRunner',
        render: function GraphRunnerMenuItem() {
          return (
            <MenuItemElement
              onClick={() => system.tabStore.getState().openTab('graphRunner')}
              key="graphRunner"
            >
              Remote Graph Runner
            </MenuItemElement>
          );
        }
      };

      menuStore
        .getState()
        .setSubMenuItems('window', [...windowMenu.items, newMenuItem]);
    }
  }

  if (!options.skipAutoConnect) {
    await runner.connect();
  }
}

export const graphRunnerClientPlugin = plugin(graphRunnerClientPluginLoader, {
  name: 'graph-runner-client'
});
