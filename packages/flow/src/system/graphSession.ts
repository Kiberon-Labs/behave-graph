import { type StoreApi } from 'zustand';
import { UndoManager } from './undoRedo';
import { PubSub } from './pubsub';
import { Graph } from './graph';
import type { System, GraphPubSys } from './system';
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
import { actionStoreFactory, type ActionStore } from '@/store/actions';
import { traceStoreFactory, type TraceStore } from '@/store/traces';
import { eventsStoreFactory, type EventsStore } from '@/store/events';
import { layerStoreFactory, type LayerStore } from '@/store/layers';
import { logStoreFactory, type LogStore } from '@/store/logs';
import { graphMetaStoreFactory, type GraphMetaStore } from '@/store/graphMeta';
import { setupSessionActions } from '@/plugin/alignment';
import type { UIGraphJSON } from '@/types/graph';

/**
 * Augmentable surface for per-graph state contributed by plugins. Mirrors
 * {@link ISystem} at the editor level: a plugin adds typed properties to every
 * graph by augmenting this interface and assigning them via
 * {@link GraphSession.decorate} from inside a session extension.
 *
 * @example
 * declare module '@/system/graphSession' {
 *   interface IGraphSession {
 *     myController?: MyController;
 *   }
 * }
 */
export interface IGraphSession { }

/**
 * Merge the augmentable surface into the class instance type. Declaration
 * merging (same-named interface + class) makes plugin-added members , set via
 * {@link GraphSession.decorate} , readable as `session.x`, which `implements`
 * alone would NOT provide.
 */
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface GraphSession extends IGraphSession { }

/**
 * A single open graph. Owns all per-graph state , nodes, edges, variables,
 * selection, traces, layers, logs, undo history and a private pubsub , so that
 * multiple graphs can be open simultaneously in complete isolation.
 *
 * Shared, editor-level resources (registry, specs, settings, notifications, ...)
 * are reached through {@link GraphSession.editor}.
 *
 * Per-graph state contributed by editor plugins is attached on creation via
 * session extensions (`system.registerSessionExtension`), which may register
 * teardown through {@link GraphSession.onDispose}.
 */
export class GraphSession {
  public readonly id: string;
  public readonly editor: System;
  /** Reactive graph-level properties (name + metadata). */
  public readonly metaStore: StoreApi<GraphMetaStore>;
  public readonly pubsub = new PubSub<GraphPubSys>();
  public readonly undoManager = new UndoManager();

  /** Display name, used as the graph tab title. Backed by {@link metaStore}. */
  get name(): string {
    return this.metaStore.getState().name;
  }
  set name(value: string) {
    this.metaStore.getState().setName(value);
  }

  public readonly controlStore: StoreApi<ControlsStore>;
  public readonly variableStore: StoreApi<VariableStore>;
  public readonly refStore: StoreApi<RefStore>;
  public readonly logsStore: StoreApi<LogStore>;
  public readonly eventsStore: StoreApi<EventsStore>;
  public readonly nodeStore: StoreApi<NodeStore>;
  public readonly edgeStore: StoreApi<EdgeStore>;
  public readonly flowStore: StoreApi<FlowStore>;
  public readonly selectionStore: StoreApi<SelectionStore>;
  public readonly actionStore: StoreApi<ActionStore>;
  public readonly layerStore: StoreApi<LayerStore>;
  public readonly traceStore: StoreApi<TraceStore>;
  public readonly graph: Graph;

  /** Cleanups registered by session extensions, run (LIFO) on {@link dispose}. */
  private readonly disposers: Array<() => void> = [];

  constructor(editor: System, id = 'graph', name = 'Graph') {
    this.id = id;
    this.editor = editor;
    this.metaStore = graphMetaStoreFactory(name);

    // Construction order preserves the dependency wiring of the old System ctor.
    this.controlStore = controlsStoreFactory();
    this.variableStore = variableStoreFactory();
    this.refStore = refStoreFactory();
    this.logsStore = logStoreFactory();
    this.eventsStore = eventsStoreFactory();
    this.nodeStore = nodeStoreFactory(this);
    this.edgeStore = edgeStoreFactory(this);
    this.flowStore = flowStoreFactory(this);
    this.selectionStore = selectionStoreFactory(this);
    this.actionStore = actionStoreFactory(this);
    this.layerStore = layerStoreFactory(this);
    this.traceStore = traceStoreFactory(this);
    this.graph = new Graph(this);

    // Per-session action subscribers (alignment, ...)
    setupSessionActions(this);
  }

  /**
   * Convenience access to the shared editor notifications service.
   */
  get notifications() {
    return this.editor.notifications;
  }

  /**
   * Attach a plugin-contributed property to this session. The companion to the
   * {@link IGraphSession} augmentation; mirrors {@link System.decorate}.
   */
  decorate<K extends keyof IGraphSession>(name: K, val: IGraphSession[K]): void {
    (this as IGraphSession)[name] = val;
  }

  /**
   * Register a cleanup to run when this session is disposed. Session extensions
   * use this (via their returned cleanup) to tear down per-graph state they
   * attached. Cleanups run in reverse registration order.
   */
  onDispose(cleanup: () => void): void {
    this.disposers.push(cleanup);
  }

  serialize(): UIGraphJSON {
    return this.graph.serialize();
  }

  /**
   * Tear down this session's reactive wiring. Called when its tab is closed so
   * its pubsub subscriptions and trace flush loop don't leak. Extension-supplied
   * cleanups run first (LIFO), then the built-in teardown.
   */
  dispose(): void {
    for (let i = this.disposers.length - 1; i >= 0; i--) {
      try {
        this.disposers[i]!();
      } catch (err) {
        console.error('GraphSession disposer failed', err);
      }
    }
    this.disposers.length = 0;

    // Per-session plugin state (e.g. the graph runner's runController) is torn
    // down by the extension cleanups registered above via onDispose , core no
    // longer reaches into plugin-owned fields here.
    this.traceStore.getState().connectEngine(undefined);
    this.pubsub.clearAllSubscriptions();
  }
}
