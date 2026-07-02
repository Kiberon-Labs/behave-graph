/**
 * Web Worker graph runner plugin for browser-based graph execution in a worker thread
 * Uses a Web Worker to execute graphs without blocking the UI
 */

import type { System } from '../../system/system.js';
import { plugin } from '../../system/plugin.js';
import { GraphRunnerClient } from '../graphrunner/client.js';
import { WorkerTransport } from './worker-transport.js';
import { graphRunnerClientPlugin } from '../graphrunner/index.js';
import { webWorkerGraphRunnerStoreFactory } from './store.js';
import { WebWorkerGraphRunnerPanel } from './panel.js';
import { MenuItemElement } from '../../components/menubar/menuItem.js';
import { ErrorBoundary } from 'react-error-boundary';

export * from './worker-transport.js';
export * from './store.js';
export * from './panel.js';

/**
 * Options for the Web Worker graph runner plugin
 */
export interface WebWorkerGraphRunnerPluginOptions {
  /**
   * Pre-configured Web Worker instance.
   * The worker should be set up with the necessary registry and message handlers.
   * The registry MUST be defined inside the worker file itself.
   *
   * Example:
   * ```ts
   * const worker = new Worker(new URL('./my-graph-worker.ts', import.meta.url), { type: 'module' });
   * ```
   */
  worker: Worker;

  /**
   * Whether to skip automatic connection.
   * Default: false (will attempt to connect immediately)
   */
  skipAutoConnect?: boolean;

  /**
   * Whether to add the menu item to the Window menu.
   * Default: true
   */
  addMenuItem?: boolean;
}

/**
 * Plugin initialization function for Web Worker graph execution
 * Registers a GraphRunnerClient with a worker transport that executes graphs in a Web Worker
 */
export async function webWorkerGraphRunnerPluginLoader(
  system: System,
  options: WebWorkerGraphRunnerPluginOptions
): Promise<void> {
  // Create web worker graph runner store
  const webWorkerStore = webWorkerGraphRunnerStoreFactory();
  system.decorate('webWorkerGraphRunnerStore', webWorkerStore);

  // Create worker transport with the user-provided worker
  const transport = new WorkerTransport(options.worker);

  // Create client with the worker transport and message activity tracking
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

  // Register the graph runner client plugin. With skipAutoConnect:false the
  // plugin calls runner.connect(), which wires the persistent client event
  // listeners (trace/logs/lifecycle) on this same client , so we must NOT wire
  // them again here, or every trace span would be recorded twice.
  await system.registerPlugin(graphRunnerClientPlugin, {
    client,
    skipAutoConnect: false
  });

  // Register the web worker graph runner panel
  system.tabLoader.register('webWorkerGraphRunner', () => {
    return {
      id: 'webWorkerGraphRunner',
      closable: true,
      title: 'Web Worker Graph Runner',
      group: 'default',
      content: () => (
        <ErrorBoundary
          fallback={<div>Error loading Web Worker Graph Runner panel</div>}
        >
          <WebWorkerGraphRunnerPanel />
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
      // Add the Web Worker Graph Runner menu item to the Window menu
      const newMenuItem = {
        name: 'webWorkerGraphRunner',
        render: function WebWorkerGraphRunnerMenuItem() {
          return (
            <MenuItemElement
              onClick={() =>
                system.tabStore.getState().openTab('webWorkerGraphRunner')
              }
              key="webWorkerGraphRunner"
            >
              Web Worker Graph Runner
            </MenuItemElement>
          );
        }
      };

      menuStore
        .getState()
        .setSubMenuItems('window', [...windowMenu.items, newMenuItem]);
    }
  }
}

export const webWorkerGraphRunnerPlugin = plugin(
  webWorkerGraphRunnerPluginLoader,
  {
    name: 'graphrunner-webworker'
  }
);
