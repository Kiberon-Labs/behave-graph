import { UndoManager } from './undoRedo';
import { type StoreApi } from 'zustand';
import type { Edge, Node, Viewport } from 'reactflow';
import { tabStoreFactory, type TabStore } from '@/store/tabs';
import { TabLoader } from './tabLoader';
import {
  systemSettingsFactory,
  type SystemSettingsStore
} from '../store/settings.js';
import { logStoreFactory, type LogStore } from '@/store/logs';
import { legendStoreFactory, type LegendStore } from '@/store/legend';
import { menubarStoreFactory, type MenuBarStore } from '@/store/menubar';
import { hotKeyStoreFactory, type HotkeyStore } from '@/store/hotKeys';
import { PubSub } from './pubsub';
import {
  edgeStoreFactory,
  flowStoreFactory,
  nodeStoreFactory,
  type EdgeStore,
  type FlowStore,
  type NodeStore
} from '@/store/flow';
import { controlsStoreFactory, type ControlsStore } from '@/store/controls';
import { variableStoreFactory, type VariableStore } from '@/store/variables';
import { selectionStoreFactory, type SelectionStore } from '@/store/selection';
import { refStoreFactory, type RefStore } from '@/store/refs';
import { Graph } from './graph';
import { actionStoreFactory, type ActionStore } from '@/store/actions';
import { registryStoreFactory, type RegistryStore } from '@/store/registry';
import { specsStoreFactory, type SpecsStore } from '@/store/specs';
import { traceStoreFactory, type TraceStore } from '@/store/traces';
import { specificStoreFactory, type SpecificStore } from '@/store/specific';
import {
  socketGeneratorStoreFactory,
  type SocketGeneratorStore
} from '@/store/socketGenerator';
import { eventsStoreFactory, type EventsStore } from '@/store/events';
import {
  documentationStoreFactory,
  type DocumentationStore
} from '@/store/documentation';
import { toolbarStoreFactory, type ToolbarStore } from '@/store/toolbar';
import { layerStoreFactory, type LayerStore } from '@/store/layers';
import { setupSystemActions } from '@/plugin/alignment';
import { Notifications } from './notifications';
import { chatStoreFactory, type ChatStore } from '@/store/chat';
import type { Renderable } from 'react-hot-toast';
import type { INodeRegistry } from '@/types/NodeMetadata';
import type { LoadablePlugin } from './plugin';
import type { UIGraphJSON } from '@/types/graph';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import type { LayoutBase } from 'rc-dock';

export type NotificationType = 'info' | 'success' | 'error' | 'loading';

export interface NotificationData {
  type: NotificationType;
  message: string;
  options?: {
    id?: string;
    duration?: number;
    position?: any;
    icon?: Renderable;
    style?: React.CSSProperties;
    className?: string;
    ariaLive?: any;
  };
}

export interface PubSys {
  'edge:added': Edge;
  'node:added': Node;
  'edge:removed': Edge;
  'node:removed': Node;
  graphAnnotationsChanged: {
    [key: string]: any;
  };
  'aiNode:trigger': {
    nodeId: string;
  };
  saveViewport: {
    index: number;
    viewport: Viewport;
  };
  missingViewPort: {
    index: number;
  };

  notification: NotificationData;
  'notification:dismiss': {
    toastId?: string;
  };
  'layout:saved': LayoutBase;
  'graph:saved': UIGraphJSON;
  'graph:inner:saved': GraphJSON;
  'chat:userMessage': {
    content: string;
  };
}

/**
 * Use this to extend the System interface when adding plugins
 */
export interface ISystem {}

export class System implements ISystem {
  public readonly actionStore: StoreApi<ActionStore>;
  public readonly pubsub = new PubSub<PubSys>();
  public readonly undoManager = new UndoManager();
  public readonly flowStore: StoreApi<FlowStore>;
  public readonly controlStore: StoreApi<ControlsStore>;
  public readonly variableStore: StoreApi<VariableStore>;
  public readonly selectionStore: StoreApi<SelectionStore>;
  public readonly refStore: StoreApi<RefStore>;
  public readonly tabStore: StoreApi<TabStore>;
  protected deps: Record<string, unknown> = {};
  public readonly registry: StoreApi<RegistryStore>;
  public readonly tabLoader: TabLoader;
  public readonly systemSettings: StoreApi<SystemSettingsStore>;
  public readonly logsStore: StoreApi<LogStore>;
  public readonly legendStore: StoreApi<LegendStore>;
  public readonly hotKeyStore: StoreApi<HotkeyStore>;
  public readonly edgeStore: StoreApi<EdgeStore>;
  public readonly nodeStore: StoreApi<NodeStore>;
  public readonly specStore: StoreApi<SpecsStore>;
  public readonly specificStore: StoreApi<SpecificStore>;
  public readonly socketGeneratorStore: StoreApi<SocketGeneratorStore>;
  public readonly eventsStore: StoreApi<EventsStore>;
  public readonly documentationStore: StoreApi<DocumentationStore>;
  public readonly toolbarStore: StoreApi<ToolbarStore>;
  public readonly layerStore: StoreApi<LayerStore>;
  public readonly menubarStore: StoreApi<MenuBarStore>;
  public readonly graph: Graph;
  public readonly traceStore: StoreApi<TraceStore>;
  public readonly chatStore: StoreApi<ChatStore>;
  public readonly notifications: Notifications = new Notifications(this);

  /**
   * Create a new System instance
   * @param registry - INodeRegistry containing nodes and values metadata
   */
  constructor(registry?: INodeRegistry) {
    this.tabStore = tabStoreFactory();
    this.controlStore = controlsStoreFactory();
    this.variableStore = variableStoreFactory();
    this.refStore = refStoreFactory();
    this.systemSettings = systemSettingsFactory();
    this.logsStore = logStoreFactory();
    this.legendStore = legendStoreFactory();
    this.eventsStore = eventsStoreFactory();
    this.nodeStore = nodeStoreFactory(this);
    this.edgeStore = edgeStoreFactory(this);
    this.flowStore = flowStoreFactory(this);
    this.selectionStore = selectionStoreFactory(this);
    this.hotKeyStore = hotKeyStoreFactory(this);
    this.actionStore = actionStoreFactory(this);
    this.registry = registryStoreFactory();
    this.specStore = specsStoreFactory(this);
    this.socketGeneratorStore = socketGeneratorStoreFactory();
    this.specificStore = specificStoreFactory();
    this.documentationStore = documentationStoreFactory();
    this.toolbarStore = toolbarStoreFactory();
    this.layerStore = layerStoreFactory(this);

    this.chatStore = chatStoreFactory();
    this.graph = new Graph(this);

    // Handle registry initialization
    if (registry) {
      this.registry.getState().updateRegistry(registry);
      this.specStore.getState().setSpecs(registry.specs);
    }

    this.menubarStore = menubarStoreFactory();
    this.tabLoader = new TabLoader(this);

    this.traceStore = traceStoreFactory(this);

    // Setup system-level action subscribers
    setupSystemActions(this);
  }

  /**
   * Adds a new dependency to the system
   * @param name
   * @param val
   */
  decorate(name: keyof System, val: any) {
    //@ts-ignore
    this[name] = val;
  }

  /**
   * Load a plugin into the system
   * @param pluginInit - Plugin initialization function
   * @param options - Optional configuration options for the plugin
   * @template TOptions - Type of options object
   *
   * @example
   * // Plugin without options
   * system.registerPlugin(docsPlugin);
   *
   * @example
   * // Plugin with typed options
   * interface MyPluginOptions {
   *   enabled: boolean;
   *   apiKey: string;
   * }
   *
   * const myPlugin: Plugin<MyPluginOptions> = (system, options) => {
   *   console.log('Plugin enabled:', options.enabled);
   * };
   *
   * system.registerPlugin(myPlugin, { enabled: true, apiKey: 'secret' });
   */
  async registerPlugin<TOptions = void>(
    plugin: LoadablePlugin<TOptions>,
    options?: TOptions
  ): Promise<void> {
    await plugin.loader(this, options as TOptions);
    console.log(`Plugin loaded: ${plugin.opts.name}`);
  }
}
