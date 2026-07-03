/**
 * Local graph runner plugin for in-browser graph execution
 * Uses the local Engine instead of a remote server
 */

import type { System } from '../../system/system.js';
import { plugin } from '../../system/plugin.js';
import type { IRegistry } from '@kiberon-labs/behave-graph';
import { buildUIGraphJSON } from '../../transformers/Uigraph.js';
import { GraphRunnerClient } from '../graphrunner/client.js';
import { LocalTransport } from './transport.js';
import {
  graphRunnerClientPlugin,
  type ServerEvent,
  type ServerVariable,
  type SessionFactory
} from '../graphrunner/index.js';
import { DefaultSessionFactory } from '../graphrunner/session.js';
import { localGraphRunnerStoreFactory } from './store.js';
import { LocalGraphRunnerPanel } from './panel.js';
import { MenuItemElement } from '../../components/menubar/menuItem.js';
import { ErrorBoundary } from 'react-error-boundary';

export * from './transport.js';
export * from './store.js';
export * from './panel.js';
export * from './types.js';

/**
 * Options for the local graph runner plugin
 */
export interface LocalGraphRunnerPluginOptions {
  /**
   * Node registry with registered nodes, values, and dependencies.
   * Required for graph execution.
   */
  registry: IRegistry;
  variables?: ServerVariable[];
  events?: ServerEvent[];
  sessionFactory?: SessionFactory;

  /**
   * Custom tick strategy hook for controlling timing between tick events.
   * If not provided, defaults to requestAnimationFrame for smooth browser refresh sync.
   */
  tickStrategy?: () => Promise<void>;

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
 * Default RAF-based tick strategy for smooth browser animation frame sync
 */
const defaultRafTickStrategy = (): Promise<void> => {
  return new Promise((resolve) => {
    requestAnimationFrame(() => resolve());
  });
};

/**
 * Plugin initialization function for local graph execution
 * Registers a GraphRunnerClient with a local transport that executes graphs in-browser
 */
export async function localGraphRunnerPluginLoader(
  system: System,
  options: LocalGraphRunnerPluginOptions
): Promise<void> {
  // Create local graph runner store
  const localStore = localGraphRunnerStoreFactory();
  system.decorate('localGraphRunnerStore', localStore);

  // Create or use provided session factory with tick strategy
  const tickStrategy = options.tickStrategy ?? defaultRafTickStrategy;
  const sessionFactory =
    options.sessionFactory ??
    new DefaultSessionFactory({
      tickStrategy
    });

  // Create local transport with access to the node registry and store.
  // `resolveGraph` lets Call Subgraph nodes run other open graphs by id.
  const transport = new LocalTransport(options.registry, {
    ...options,
    store: localStore,
    sessionFactory,
    resolveGraph: (id) => {
      const target = system.activeGraph.getState().sessions[id];
      return target ? buildUIGraphJSON(target).flow : undefined;
    }
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

  // Register the graph runner client plugin
  // This will create the graphRunnerClientStore and decorate it on the system
  system.registerPlugin(graphRunnerClientPlugin, {
    client
  });

  // Register the local graph runner panel
  system.tabLoader.register('localGraphRunner', () => {
    return {
      id: 'localGraphRunner',
      closable: true,
      title: 'Local Graph Runner',
      group: 'default',
      content: () => (
        <ErrorBoundary
          fallback={<div>Error loading Local Graph Runner panel</div>}
        >
          <LocalGraphRunnerPanel />
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
      // Add the Local Graph Runner menu item to the Window menu
      const newMenuItem = {
        name: 'localGraphRunner',
        render: function LocalGraphRunnerMenuItem() {
          return (
            <MenuItemElement
              onClick={() =>
                system.tabStore.getState().openTab('localGraphRunner')
              }
              key="localGraphRunner"
            >
              Local Graph Runner
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

export const localGraphRunnerPlugin = plugin(localGraphRunnerPluginLoader, {
  name: 'graphrunner-local'
});
