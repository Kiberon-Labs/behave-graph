import { UndoManager } from './undoRedo';
import { type StoreApi } from 'zustand';
import type { Edge, Viewport } from 'reactflow';
import { tabStoreFactory, type TabStore } from '@/store/tabs';
import { TabLoader } from './tabLoader';
import {
  ManualLifecycleEventEmitter,
  type IRegistry,
  type LogSeverity
} from '@kinforge/behave-graph';
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
import { GraphRunner } from './runner';

export type PubSys = {
  newEdge: Edge;
  graphAnnotationsChanged: {
    [key: string]: any;
  };
  saveViewport: {
    index: number;
    viewport: Viewport;
  };
  missingViewPort: {
    index: number;
  };
};

export class System {
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
  public readonly registry: IRegistry;
  public readonly tabLoader: TabLoader;
  public readonly systemSettings: StoreApi<SystemSettingsStore>;
  public readonly logsStore: StoreApi<LogStore>;
  public readonly legendStore: StoreApi<LegendStore>;
  public readonly hotKeyStore: StoreApi<HotkeyStore>;
  public readonly edgeStore: StoreApi<EdgeStore>;
  public readonly nodeStore: StoreApi<NodeStore>;
  public readonly menubarStore: StoreApi<MenuBarStore>;
  public readonly graph: Graph;
  public readonly runner: GraphRunner;

  constructor(registry?: IRegistry) {
    this.tabStore = tabStoreFactory();
    this.controlStore = controlsStoreFactory();
    this.variableStore = variableStoreFactory();
    this.selectionStore = selectionStoreFactory();
    this.refStore = refStoreFactory();
    this.systemSettings = systemSettingsFactory();
    this.logsStore = logStoreFactory();
    this.legendStore = legendStoreFactory();
    this.flowStore = flowStoreFactory(this);
    this.nodeStore = nodeStoreFactory(this);
    this.edgeStore = edgeStoreFactory(this);
    this.hotKeyStore = hotKeyStoreFactory(this);
    this.actionStore = actionStoreFactory(this);

    const log = this.logsStore.getState();
    this.graph = new Graph(this);

    const logger = {
      log: (severity: LogSeverity, text: string) => {
        log.append({
          time: new Date(),
          data: text,
          type: severity
        });
      }
    };

    const initReg = registry ?? {
      nodes: {},
      values: {},
      dependencies: {}
    };

    this.registry = {
      ...initReg,
      dependencies: {
        ILifecycleEventEmitter: new ManualLifecycleEventEmitter(),
        ...initReg.dependencies,
        //Inject the logger
        ILogger: logger
      }
    };

    this.menubarStore = menubarStoreFactory();
    this.tabLoader = new TabLoader(this);

    // Initialize runner and runner store
    this.runner = new GraphRunner(this);
  }

  /**
   * Adds a new dependency to the system
   * @param name
   * @param val
   */
  decorate(name: string, val: any) {
    this.deps[name] = val;
  }

  /**
   * Load a plugin into the system
   * @param pluginInit
   */
  registerPlugin(pluginInit: (sys: System) => void) {
    pluginInit(this);
  }
}
