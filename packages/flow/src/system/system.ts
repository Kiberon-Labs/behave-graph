import { type StoreApi } from 'zustand';
import { createStore } from 'zustand/vanilla';
import type { Edge, Node, Viewport } from 'reactflow';
import { tabStoreFactory, type TabStore } from '@/store/tabs';
import { TabLoader } from './tabLoader';
import {
  systemSettingsFactory,
  PERSISTED_SETTING_KEYS,
  type SystemSettingsStore
} from '../store/settings.js';
import {
  settingsSchemaStoreFactory,
  type SettingsSchemaStore,
  type SettingDescriptor
} from '../store/settingsSchema.js';
import { legendStoreFactory, type LegendStore } from '@/store/legend';
import { menubarStoreFactory, type MenuBarStore } from '@/store/menubar';
import { hotKeyStoreFactory, type HotkeyStore } from '@/store/hotKeys';
import { PubSub } from './pubsub';
import { controlsStoreFactory, type ControlsStore } from '@/store/controls';
import { selectionStoreFactory, type SelectionStore } from '@/store/selection';
import { registryStoreFactory, type RegistryStore } from '@/store/registry';
import { specsStoreFactory, type SpecsStore } from '@/store/specs';
import { specificStoreFactory, type SpecificStore } from '@/store/specific';
import {
  socketGeneratorStoreFactory,
  type SocketGeneratorStore
} from '@/store/socketGenerator';
import {
  documentationStoreFactory,
  type DocumentationStore
} from '@/store/documentation';
import { toolbarStoreFactory, type ToolbarStore } from '@/store/toolbar';
import { Notifications, type NotificationData } from './notifications';
import { chatStoreFactory, type ChatStore } from '@/store/chat';
import {
  conversionStoreFactory,
  type ConversionStore,
  type ConversionRule
} from '@/store/conversions';
import {
  commandStoreFactory,
  registerDefaultCommands,
  type CommandStore,
  type CommandContext
} from '@/store/commands';
import {
  contextMenuStoreFactory,
  registerDefaultContextMenu,
  type ContextMenuStore
} from '@/store/contextMenu';
import { GraphSession } from './graphSession';
import { v4 as uuidv4 } from 'uuid';
import { tabIdForSession } from '@/components/layoutController/utils';
import type { Renderable } from 'react-hot-toast';
import type { INodeRegistry } from '@/types/NodeMetadata';
import type { LoadablePlugin, SessionExtension } from './plugin';
import type { UIGraphJSON } from '@/types/graph';
import type { GraphJSON } from '@kiberon-labs/behave-graph';
import type { LayoutBase } from 'rc-dock';
import type { FlowStore, NodeStore, EdgeStore } from '@/store/flow';
import type { VariableStore } from '@/store/variables';
import type { RefStore } from '@/store/refs';
import type { ActionStore } from '@/store/actions';
import type { TraceStore } from '@/store/traces';
import type { EventsStore } from '@/store/events';
import type { LogStore } from '@/store/logs';
import type { LayerStore } from '@/store/layers';
import type { UndoManager } from './undoRedo';
import type { Graph } from './graph';



/**
 * Editor-level pubsub topics. These are global to the editor and shared across
 * every open graph. Augment this interface (not {@link GraphPubSys}) for events
 * that are not tied to a specific graph.
 */
export interface EditorPubSys {
  notification: NotificationData;
  'notification:dismiss': {
    toastId?: string;
  };
  'layout:saved': LayoutBase;
  'graph:saved': UIGraphJSON;
  'graph:inner:saved': GraphJSON;
  /**
   * Published by the conversation panel when the user submits input. The AI
   * subsystem (see the `@kiberon-labs/behave-graph-nodes-ai` package) subscribes
   * to drive the agent and stream a reply back into the chat store.
   */
  'chat:userMessage': { content: string };
}

/**
 * Per-graph pubsub topics. Each {@link GraphSession} owns its own bus typed with
 * this interface, so events stay isolated to the graph that produced them.
 * Augment this interface for events that belong to a single graph.
 */
export interface GraphPubSys {
  'edge:added': Edge;
  'node:added': Node;
  'edge:removed': Edge;
  'node:removed': Node;
  graphAnnotationsChanged: {
    [key: string]: any;
  };
  saveViewport: {
    index: number;
    viewport: Viewport;
  };
}

/**
 * Combined pubsub surface kept for backwards compatibility. Prefer the split
 * {@link EditorPubSys} / {@link GraphPubSys} interfaces.
 */
export interface PubSys extends EditorPubSys, GraphPubSys { }

/**
 * Use this to extend the System interface when adding plugins
 */
export interface ISystem { }

/** Minimal storage adapter for persisting editor settings. */
export type SettingsStorage = {
  getItem: (key: string) => string | null;
  setItem: (key: string, value: string) => void;
};

/** Serialized editor-level settings (UI toggles + custom type conversions). */
export type EditorSettingsJSON = {
  settings?: Record<string, any>;
  conversions?: ConversionRule[];
};

const SETTINGS_STORAGE_KEY = 'behave-graph:editor-settings';

const settingSetterName = (key: string): string =>
  `set${key.charAt(0).toUpperCase()}${key.slice(1)}`;

const defaultSettingsStorage = (): SettingsStorage | undefined => {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {
    // localStorage access can throw in sandboxed contexts
  }
  return undefined;
};

/**
 * Observable registry of open graph sessions plus the currently focused one.
 * Backed by a zustand store so panels rendered outside of a graph tab can
 * subscribe and re-render when the active graph changes.
 */
export type ActiveGraphStore = {
  activeGraphId: string | null;
  sessions: Record<string, GraphSession>;
  setActiveGraph: (id: string | null) => void;
  addSession: (session: GraphSession) => void;
  removeSession: (id: string) => void;
  getActive: () => GraphSession | undefined;
};

const activeGraphStoreFactory = () =>
  createStore<ActiveGraphStore>((set, get) => ({
    activeGraphId: null,
    sessions: {},
    setActiveGraph: (activeGraphId) => set(() => ({ activeGraphId })),
    addSession: (session) =>
      set((state) => ({
        sessions: { ...state.sessions, [session.id]: session }
      })),
    removeSession: (id) =>
      set((state) => {
        const next = { ...state.sessions };
        delete next[id];
        const activeGraphId =
          state.activeGraphId === id ? null : state.activeGraphId;
        return { sessions: next, activeGraphId };
      }),
    getActive: () => {
      const state = get();
      return state.activeGraphId
        ? state.sessions[state.activeGraphId]
        : undefined;
    }
  }));

/**
 * The editor-level system. Holds state that is shared across every open graph
 * (settings, registry, specs, menubar, tabs, ...) plus an observable registry of
 * per-graph {@link GraphSession} instances. Per-graph state itself lives on the
 * sessions, not here.
 *
 * The class is intentionally still named `System` so existing `declare module`
 * augmentations (`interface System { ... }`) keep merging and the public API is
 * stable; `EditorSystem` is exported as an alias for new code.
 */
export class System implements ISystem {
  public readonly pubsub = new PubSub<EditorPubSys>();
  public readonly tabStore: StoreApi<TabStore>;
  public readonly tabLoader: TabLoader;
  public readonly systemSettings: StoreApi<SystemSettingsStore>;
  /** Registry of setting descriptors driving the auto-generated Settings panel. */
  public readonly settingsSchema: StoreApi<SettingsSchemaStore>;
  public readonly legendStore: StoreApi<LegendStore>;
  public readonly menubarStore: StoreApi<MenuBarStore>;
  public readonly hotKeyStore: StoreApi<HotkeyStore>;
  public readonly registry: StoreApi<RegistryStore>;
  public readonly specStore: StoreApi<SpecsStore>;
  public readonly specificStore: StoreApi<SpecificStore>;
  public readonly socketGeneratorStore: StoreApi<SocketGeneratorStore>;
  public readonly documentationStore: StoreApi<DocumentationStore>;
  public readonly toolbarStore: StoreApi<ToolbarStore>;
  public readonly controlStore: StoreApi<ControlsStore>;
  public readonly chatStore: StoreApi<ChatStore>;
  /** User/plugin-defined automatic type conversions for auto-convert. */
  public readonly conversionStore: StoreApi<ConversionStore>;
  /** Named, dispatchable commands shared across hotkeys/menus/toolbar. */
  public readonly commandStore: StoreApi<CommandStore>;
  /** Per-target context-menu item registry (node/edge/selection/pane). */
  public readonly contextMenuStore: StoreApi<ContextMenuStore>;
  public readonly notifications: Notifications = new Notifications(this);

  /** Observable registry of open graph sessions + the focused one. */
  public readonly activeGraph: StoreApi<ActiveGraphStore>;

  /** Editor-level extensions applied to every graph session on creation. */
  private readonly sessionExtensions = new Set<SessionExtension>();

  protected deps: Record<string, unknown> = {};

  /**
   * Create a new editor System instance
   * @param registry - INodeRegistry containing nodes and values metadata
   */
  constructor(registry?: INodeRegistry) {
    this.activeGraph = activeGraphStoreFactory();
    this.tabStore = tabStoreFactory();
    this.controlStore = controlsStoreFactory();
    this.systemSettings = systemSettingsFactory();
    // Seeded with the built-in setting descriptors (DEFAULT_SETTINGS). Plugins
    // append their own via registerSetting(...).
    this.settingsSchema = settingsSchemaStoreFactory();
    this.legendStore = legendStoreFactory();
    this.registry = registryStoreFactory();
    this.specStore = specsStoreFactory(this);
    this.socketGeneratorStore = socketGeneratorStoreFactory();
    this.specificStore = specificStoreFactory();
    this.documentationStore = documentationStoreFactory();
    this.toolbarStore = toolbarStoreFactory();
    this.chatStore = chatStoreFactory();
    this.conversionStore = conversionStoreFactory();
    this.commandStore = commandStoreFactory();
    this.contextMenuStore = contextMenuStoreFactory();
    this.hotKeyStore = hotKeyStoreFactory(this);

    // Seed the built-in commands + context-menu items. Hosts can override by id
    // or add their own via these registries.
    registerDefaultCommands(this.commandStore);
    registerDefaultContextMenu(this.contextMenuStore);

    // Handle registry initialization
    if (registry) {
      this.registry.getState().updateRegistry(registry);
      this.specStore.getState().setSpecs(registry.specs);
    }

    this.menubarStore = menubarStoreFactory();
    this.tabLoader = new TabLoader(this);
  }

  /**
   * The currently focused graph session, if any.
   */
  get session(): GraphSession | undefined {
    return this.activeGraph.getState().getActive();
  }

  /**
   * Create a new graph session, register it and (by default) make it active.
   */
  createSession(
    id = 'graph',
    options?: { activate?: boolean; name?: string }
  ): GraphSession {
    const session = new GraphSession(this, id, options?.name ?? 'Graph');
    this.activeGraph.getState().addSession(session);
    // Let editor plugins extend the fully-constructed session before it becomes
    // active, so panels reacting to the active graph see a complete instance.
    for (const extension of this.sessionExtensions) {
      this.applySessionExtension(session, extension);
    }
    if (options?.activate ?? true) {
      this.activeGraph.getState().setActiveGraph(id);
    }
    return session;
  }

  /**
   * Look up an existing session by id, creating an empty one if missing.
   */
  getOrCreateSession(id: string): GraphSession {
    return (
      this.activeGraph.getState().sessions[id] ??
      this.createSession(id, { activate: false })
    );
  }

  /**
   * Create a brand new, empty graph in its own tab and focus it.
   */
  newGraph(name?: string): GraphSession {
    const id = uuidv4();
    const count = Object.keys(this.activeGraph.getState().sessions).length;
    const session = this.createSession(id, {
      activate: true,
      name: name ?? `Untitled ${count}`
    });
    this.tabStore.getState().openTab(tabIdForSession(id));
    return session;
  }

  /**
   * Dispose a graph session and remove it from the registry. Called when its
   * tab is closed.
   */
  disposeSession(id: string): void {
    const session = this.activeGraph.getState().sessions[id];
    if (!session) return;
    session.dispose();
    this.activeGraph.getState().removeSession(id);
  }

  // ---------------------------------------------------------------------------
  // Focused-graph accessors.
  //
  // All graph-canvas and dock-panel consumers read per-graph state through
  // useGraph()/useActiveGraph(), and execution is per-session via each
  // GraphSession's run controller. These getters remain only for editor-level
  // surfaces that imperatively act on the *focused* graph , the hotkey handlers,
  // layout utilities, the menubar, and server-metadata fan-out. They resolve to
  // the focused session, consistent with the "panels follow focus" model; they
  // are a convenience, not a single-open-graph limit (multiple graphs are open
  // and independently runnable at once).
  // ---------------------------------------------------------------------------
  get flowStore(): StoreApi<FlowStore> {
    return this.session!.flowStore;
  }
  get nodeStore(): StoreApi<NodeStore> {
    return this.session!.nodeStore;
  }
  get edgeStore(): StoreApi<EdgeStore> {
    return this.session!.edgeStore;
  }
  get variableStore(): StoreApi<VariableStore> {
    return this.session!.variableStore;
  }
  get selectionStore(): StoreApi<SelectionStore> {
    return this.session!.selectionStore;
  }
  get refStore(): StoreApi<RefStore> {
    return this.session!.refStore;
  }
  get actionStore(): StoreApi<ActionStore> {
    return this.session!.actionStore;
  }
  get traceStore(): StoreApi<TraceStore> {
    return this.session!.traceStore;
  }
  get eventsStore(): StoreApi<EventsStore> {
    return this.session!.eventsStore;
  }
  get logsStore(): StoreApi<LogStore> {
    return this.session!.logsStore;
  }
  get layerStore(): StoreApi<LayerStore> {
    return this.session!.layerStore;
  }
  get graph(): Graph {
    return this.session!.graph;
  }
  get undoManager(): UndoManager {
    return this.session!.undoManager;
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

  /**
   * Register an extension applied to every {@link GraphSession}. It runs against
   * each graph already open at registration time and against every graph created
   * afterwards (via {@link createSession}), so a plugin can attach per-graph
   * state to new graph instances from a single editor-level registration.
   *
   * If the extension returns a cleanup it is wired to the session's
   * {@link GraphSession.onDispose} and runs when that graph's tab is closed.
   *
   * @returns an unregister function that stops the extension from applying to
   * sessions created later. It does not retroactively tear down sessions already
   * extended (those clean up on their own dispose).
   */
  registerSessionExtension(extension: SessionExtension): () => void {
    this.sessionExtensions.add(extension);
    // Apply to graphs that already exist so registration order doesn't matter.
    for (const session of Object.values(this.activeGraph.getState().sessions)) {
      this.applySessionExtension(session, extension);
    }
    return () => {
      this.sessionExtensions.delete(extension);
    };
  }

  /** Run a single session extension, wiring any returned cleanup to dispose. */
  private applySessionExtension(
    session: GraphSession,
    extension: SessionExtension
  ): void {
    try {
      const cleanup = extension(session);
      if (typeof cleanup === 'function') session.onDispose(cleanup);
    } catch (err) {
      console.error('Session extension failed', err);
    }
  }

  /**
   * Register a custom automatic type conversion (e.g. from a profile plugin) so
   * auto-convert can splice in the given node for that type pair.
   */
  registerConversion(rule: ConversionRule): void {
    this.conversionStore.getState().registerConversion(rule);
  }

  /**
   * Contribute a setting to the schema-driven Settings panel. The panel
   * auto-generates a row for it (grouped under `descriptor.section`), and its
   * default value is seeded into the settings store if not already present.
   * Built-in settings are registered the same way at construction.
   *
   * @example
   * system.registerSetting({
   *   key: 'graphRunner.autoStart', section: 'Graph Runner', type: 'boolean',
   *   default: false, title: 'Auto-start runner'
   * });
   */
  registerSetting(descriptor: SettingDescriptor): void {
    if (descriptor.type !== 'custom' && !(descriptor.key in this.systemSettings.getState())) {
      this.systemSettings.getState().setSetting(descriptor.key, descriptor.default);
    }
    this.settingsSchema.getState().registerSetting(descriptor);
  }

  /** Contribute several settings at once. */
  registerSettings(descriptors: SettingDescriptor[]): void {
    for (const descriptor of descriptors) this.registerSetting(descriptor);
  }

  /** Read a setting value by key (built-in or plugin-contributed). */
  getSetting<T = unknown>(key: string): T {
    return this.systemSettings.getState()[key] as T;
  }

  /** Set a setting value by key. Persists if the descriptor allows it. */
  setSetting(key: string, value: unknown): void {
    this.systemSettings.getState().setSetting(key, value);
  }

  /**
   * Dispatch a registered command against the focused graph (or a supplied
   * session). Convenience used by hotkeys, the menubar and the toolbar so they
   * share one dispatch path. No-ops if there is no graph to act on.
   */
  runCommand(id: string, ctx?: Partial<CommandContext>): void | Promise<void> {
    const session = ctx?.session ?? this.session;
    if (!session) return;
    return this.commandStore
      .getState()
      .run(id, { editor: this, session, ...ctx });
  }

  /**
   * Serialize the persistable editor settings , the UI toggles plus any custom
   * type conversions , to a plain JSON object.
   */
  serializeSettings(): EditorSettingsJSON {
    const state = this.systemSettings.getState() as Record<string, any>;
    const settings: Record<string, any> = {};
    for (const key of this.persistedSettingKeys()) settings[key] = state[key];
    return {
      settings,
      conversions: this.conversionStore.getState().conversions
    };
  }

  /**
   * Keys round-tripped to persisted storage: the built-in persisted keys plus
   * every plugin-contributed descriptor that opts in (`persist !== false`).
   * Custom descriptors carry no backing value, so they are excluded.
   */
  private persistedSettingKeys(): string[] {
    const keys = new Set<string>(PERSISTED_SETTING_KEYS as string[]);
    for (const descriptor of this.settingsSchema.getState().settings) {
      if (descriptor.type === 'custom' || descriptor.persist === false) continue;
      keys.add(descriptor.key);
    }
    return [...keys];
  }

  /**
   * Apply previously-serialized editor settings (toggles + conversions).
   * Unknown keys are ignored.
   */
  applySettings(json: EditorSettingsJSON | undefined): void {
    if (!json) return;
    const state = this.systemSettings.getState() as Record<string, any>;
    for (const [key, value] of Object.entries(json.settings ?? {})) {
      if (value === undefined) continue;
      const setter = state[settingSetterName(key)];
      if (typeof setter === 'function') setter(value);
      // Plugin-contributed keys have no typed setter: write generically.
      else if (typeof state.setSetting === 'function') state.setSetting(key, value);
    }
    if (Array.isArray(json.conversions)) {
      this.conversionStore.getState().setConversions(json.conversions);
    }
  }

  /**
   * Persist editor settings + conversions to a storage adapter (localStorage by
   * default). Applies any saved state immediately, then saves (debounced) on
   * change. Returns a disposer. A host can pass its own storage adapter (e.g.
   * one backed by VS Code workspace state) instead of localStorage.
   */
  enableSettingsPersistence(
    storage: SettingsStorage | undefined = defaultSettingsStorage()
  ): () => void {
    if (!storage) return () => { };

    try {
      const raw = storage.getItem(SETTINGS_STORAGE_KEY);
      if (raw) this.applySettings(JSON.parse(raw));
    } catch {
      // ignore malformed saved state
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    const save = () => {
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        try {
          storage.setItem(
            SETTINGS_STORAGE_KEY,
            JSON.stringify(this.serializeSettings())
          );
        } catch {
          // ignore quota / serialization errors
        }
      }, 300);
    };

    const unsubSettings = this.systemSettings.subscribe(save);
    const unsubConversions = this.conversionStore.subscribe(save);
    return () => {
      if (timer) clearTimeout(timer);
      unsubSettings();
      unsubConversions();
    };
  }
}

/**
 * Alias for {@link System} expressing its role as the shared editor-level system.
 */
export { System as EditorSystem };
