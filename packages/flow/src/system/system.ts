import EventEmitter from 'component-emitter';
import { UndoManager } from './undoRedo';
import { createStore, type StoreApi, type UseBoundStore } from 'zustand';
import type { ReactFlowInstance } from 'reactflow';
import { tabStoreFactory, type TabStore } from '@/store/tabs';
import { TabLoader } from './tabLoader';
import {
  ManualLifecycleEventEmitter,
  type GraphJSON,
  type IRegistry,
  type LogSeverity
} from '@kiberon-labs/behave-graph';
import {
  systemSettingsFactory,
  type SystemSettingsStore
} from '../store/settings.js';
import { logStoreFactory, type LogStore } from '@/store/logs';
import { legendStoreFactory, type LegendStore } from '@/store/legend';
import { menubarStoreFactory, type MenuBarStore } from '@/store/menubar';
import { hotKeyStoreFactory, type HotkeyStore } from '@/store/hotKeys';

type FlowStore = {
  initialGraph?: GraphJSON;
  flow?: ReactFlowInstance;
  setFlow: (flow: ReactFlowInstance) => void;
  setInitialGraph: (graph: GraphJSON) => void;
};

const flowStoreFactory = () =>
  createStore<FlowStore>((set) => ({
    flow: undefined,
    initialGraph: undefined,

    setInitialGraph: (initialGraph: GraphJSON) => {
      set(() => ({
        initialGraph
      }));
    },

    setFlow: (flow: ReactFlowInstance) => {
      set(() => ({
        flow
      }));
    }
  }));

export class System {
  public readonly eventEmitter: InstanceType<typeof EventEmitter> =
    new EventEmitter();
  public readonly undoManager = new UndoManager();
  public readonly flowStore: StoreApi<FlowStore>;
  public readonly useTabStore: UseBoundStore<StoreApi<TabStore>>;
  protected deps: Record<string, unknown> = {};
  public readonly registry: IRegistry;
  public readonly tabLoader: TabLoader;
  public readonly useSystemSettings: UseBoundStore<
    StoreApi<SystemSettingsStore>
  >;
  public readonly logsStore: StoreApi<LogStore>;
  public readonly legendStore: StoreApi<LegendStore>;
  public readonly hotKeyStore: StoreApi<HotkeyStore>;

  public readonly menubarStore: StoreApi<MenuBarStore>;

  constructor(registry?: IRegistry) {
    this.flowStore = flowStoreFactory();
    this.useTabStore = tabStoreFactory();
    this.useSystemSettings = systemSettingsFactory();
    this.logsStore = logStoreFactory();
    this.legendStore = legendStoreFactory();
    this.hotKeyStore = hotKeyStoreFactory();

    const log = this.logsStore.getState();

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
  }

  register(name: string, val: any) {
    this.deps[name] = val;
  }
}
