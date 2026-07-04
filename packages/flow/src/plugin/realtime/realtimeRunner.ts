import {
  Engine,
  type GraphInstance,
  type ILifecycleEventEmitter,
  type IRegistry,
  isFunctionNode,
  readGraphFromJSON
} from '@kiberon-labs/behave-graph';
import { create, type StoreApi } from 'zustand';

import type { System } from '@/system/system.js';
import { flowToBehave } from '@/transformers/flowToBehave.js';
import { realtime } from '@/annotations';

export type RealtimeRunnerStore = {
  engine?: Engine;
  /** Live output values published for UI consumers (keyed by nodeId -> outputName) */
  outputs: Record<string, Record<string, unknown>>;
  setEngine: (engine?: Engine) => void;
  setOutputs: (
    updates: Array<{ nodeId: string; outputName: string; value: unknown }>
  ) => void;
};

const realtimeRunnerStoreFactory = () =>
  create<RealtimeRunnerStore>((set) => ({
    engine: undefined,
    outputs: {},
    setEngine: (engine) => set({ engine }),
    setOutputs: (updates) =>
      set((state) => {
        if (updates.length === 0) return state;

        let changed = false;
        const nextOutputs: Record<string, Record<string, unknown>> = {
          ...state.outputs
        };

        for (const { nodeId, outputName, value } of updates) {
          const prevNode = nextOutputs[nodeId] ?? state.outputs[nodeId];
          const prevVal = prevNode?.[outputName];
          if (Object.is(prevVal, value)) continue;

          const base = prevNode ?? {};
          // Copy-on-write per node
          const nextNode = base === prevNode ? { ...base } : { ...base };
          nextNode[outputName] = value;
          nextOutputs[nodeId] = nextNode;
          changed = true;
        }

        if (!changed) return state;
        return { outputs: nextOutputs };
      })
  }));

/**
 * RealtimeRunner keeps a small preview Engine up-to-date with the current graph.
 * It is designed for UI previews (e.g. live node output thumbnails) and does not
 * replace the existing `GraphRunner`.
 */
export class RealtimeRunner {
  private system: System;
  private executionRegistry?: IRegistry;
  private graphInstance?: GraphInstance;
  private engine?: Engine;
  private scheduled = false;
  private tickRafHandle?: number;
  private tickTimeoutHandle?: number;
  private tickLoopActive = false;
  private tickInProgress = false;
  private lastTickAtMs = 0;
  private readonly tickIntervalMs = 50;
  private unsubscribers: Array<() => void> = [];
  private watched = new Map<string, Set<string>>();
  private lastPublished = new Map<string, Map<string, unknown>>();
  private lastGraphSignature?: string;
  private annotatedOutputNodeIds: string[] = [];

  public readonly store: StoreApi<RealtimeRunnerStore>;

  constructor(system: System, executionRegistry?: IRegistry) {
    this.system = system;
    this.executionRegistry = executionRegistry;
    this.store = realtimeRunnerStoreFactory();

    // Start in a low-impact mode; actual ticking only happens when something is watched.
    this.start();
  }

  getEngine(): Engine | undefined {
    return this.engine;
  }

  /**
   * Get a value from a node's output socket, if available.
   */
  getNodeOutputValue(nodeId: string, outputName: string): unknown {
    const node = this.engine?.nodes?.[nodeId];
    const socket = node?.outputs?.find((s: any) => s.name === outputName);
    return socket?.value;
  }

  /**
   * Register interest in a particular node output. Used to keep the preview runner efficient.
   */
  watchNodeOutput(nodeId: string, outputName: string): () => void {
    const existing = this.watched.get(nodeId);
    if (existing) {
      existing.add(outputName);
    } else {
      this.watched.set(nodeId, new Set([outputName]));
    }

    this.ensureTicking();
    this.scheduleEvaluate();

    return () => {
      const set = this.watched.get(nodeId);
      if (!set) return;
      set.delete(outputName);
      if (set.size === 0) this.watched.delete(nodeId);
      this.ensureTicking();
    };
  }

  start(): void {
    this.stop();

    // Rebuild/re-evaluate when graph inputs change.
    this.unsubscribers.push(
      this.system.nodeStore.subscribe(() => this.scheduleEvaluate())
    );
    this.unsubscribers.push(
      this.system.edgeStore.subscribe(() => this.scheduleEvaluate())
    );
    this.unsubscribers.push(
      this.system.variableStore.subscribe(() => this.scheduleEvaluate())
    );
    this.unsubscribers.push(
      this.system.specStore.subscribe(() => this.scheduleEvaluate())
    );
    this.unsubscribers.push(
      this.system.registry.subscribe(() => this.scheduleEvaluate())
    );

    this.scheduleEvaluate();
  }

  stop(): void {
    this.unsubscribers.forEach((u) => u());
    this.unsubscribers = [];

    this.stopTickLoop();

    if (this.engine) {
      this.engine.dispose();
      this.engine = undefined;
      this.graphInstance = undefined;
      this.store.getState().setEngine(undefined);
    }
  }

  triggerNode(nodeId: string): void {
    const node = this.engine?.nodes?.[nodeId];
    if (!node) {
      throw new Error(`node not found: ${nodeId}`);
    }
    this.engine?.trigger(node, 'flow');
    // this.engine?.executeAllSync(100,1);
    // this.startTickLoop();
  }

  private ensureTicking(): void {
    const hasWatchers = this.watched.size > 0;

    if (hasWatchers) {
      this.startTickLoop();
      return;
    }

    this.stopTickLoop();
  }

  private nowMs(): number {
    return typeof performance !== 'undefined' && performance.now
      ? performance.now()
      : Date.now();
  }

  private startTickLoop(): void {
    if (
      this.tickRafHandle !== undefined ||
      this.tickTimeoutHandle !== undefined
    ) {
      return;
    }

    this.tickLoopActive = true;

    this.lastTickAtMs = this.nowMs();
    this.scheduleNextTick();
  }

  private stopTickLoop(): void {
    this.tickLoopActive = false;
    if (this.tickRafHandle !== undefined) {
      window.cancelAnimationFrame(this.tickRafHandle);
      this.tickRafHandle = undefined;
    }
    if (this.tickTimeoutHandle !== undefined) {
      window.clearTimeout(this.tickTimeoutHandle);
      this.tickTimeoutHandle = undefined;
    }
  }

  private scheduleNextTick(): void {
    if (!this.tickLoopActive) return;
    //TODO REadd
    // if (this.watched.size === 0) return;
    if (
      this.tickRafHandle !== undefined ||
      this.tickTimeoutHandle !== undefined
    )
      return;

    const raf = window.requestAnimationFrame;
    if (typeof raf === 'function') {
      this.tickRafHandle = raf((timestampMs) => {
        this.tickRafHandle = undefined;

        if (!this.tickLoopActive) return;
        // if (this.watched.size === 0) return;

        const now =
          typeof timestampMs === 'number' ? timestampMs : this.nowMs();
        if (now - this.lastTickAtMs >= this.tickIntervalMs) {
          if (this.tickInProgress) return;

          this.tickInProgress = true;
          this.lastTickAtMs = now;
          void this.tick().finally(() => {
            this.tickInProgress = false;
            this.scheduleNextTick();
          });
          return;
        }

        this.scheduleNextTick();
      });
      return;
    }

    // Fallback (non-browser/test environments).
    this.tickTimeoutHandle = window.setTimeout(() => {
      this.tickTimeoutHandle = undefined;
      if (!this.tickLoopActive) return;
      // if (this.watched.size === 0) return;
      if (this.tickInProgress) return;

      this.tickInProgress = true;
      this.lastTickAtMs = this.nowMs();
      void this.tick().finally(() => {
        this.tickInProgress = false;
        this.scheduleNextTick();
      });
    }, this.tickIntervalMs);
  }

  private scheduleEvaluate(): void {
    if (this.scheduled) return;
    this.scheduled = true;

    // Batch rapid changes (dragging, typing) into a single eval.
    window.setTimeout(() => {
      this.scheduled = false;
      void this.evaluate();
    }, 50);
  }

  private stripNonSemanticMetadata(graphJson: any): any {
    // We want previews to react to semantic changes (types/ports/edges/vars),
    // not editor-only movement/selection changes.
    if (!graphJson?.nodes) return graphJson;
    const nodes = graphJson.nodes.map((n: any) => {
      if (!n || typeof n !== 'object') return n;
      if (!n.metadata) return n;

      const meta = { ...n.metadata };
      delete meta.positionX;
      delete meta.positionY;

      const hasMeta = Object.keys(meta).length > 0;
      return hasMeta ? { ...n, metadata: meta } : { ...n, metadata: undefined };
    });
    return { ...graphJson, nodes };
  }

  private computeGraphSignature(graphJson: any): string {
    // Stable enough for our preview use-case.
    return JSON.stringify(graphJson);
  }

  private mergeNodeAnnotationsIntoMetadata(
    graphJson: any,
    flowNodes: any[]
  ): any {
    // The editor stores node annotations in ReactFlow `node.data.annotations`.
    // The execution engine only sees behave-graph `node.metadata` (string map),
    // so we merge annotations into metadata here.
    if (!graphJson?.nodes) return graphJson;

    const byId = new Map<string, any>();
    for (const n of flowNodes) {
      if (n?.id) byId.set(n.id, n);
    }

    const nodes = graphJson.nodes.map((nodeJson: any) => {
      const flowNode = byId.get(nodeJson?.id);
      const annotations = flowNode?.data?.annotations;
      if (!annotations || typeof annotations !== 'object') return nodeJson;

      const meta: Record<string, string> = {
        ...(nodeJson.metadata as Record<string, string> | undefined)
      };
      for (const [key, value] of Object.entries(annotations)) {
        if (value === undefined) continue;
        if (typeof value === 'string') {
          meta[key] = value;
          continue;
        }
        if (typeof value === 'number' || typeof value === 'boolean') {
          meta[key] = String(value);
          continue;
        }
        try {
          meta[key] = JSON.stringify(value);
        } catch {
          meta[key] = String(value);
        }
      }

      return { ...nodeJson, metadata: meta };
    });

    return { ...graphJson, nodes };
  }

  private isRealtimeOutputNode(node: any): boolean {
    const meta = node?.metadata;
    if (!meta || typeof meta !== 'object') return false;

    const rawFlag = meta[realtime];

    return !(rawFlag === undefined || rawFlag === null);
  }

  private rebuildAnnotatedOutputNodeCache(): void {
    if (!this.engine?.nodes) {
      this.annotatedOutputNodeIds = [];
      return;
    }

    const ids: string[] = [];
    for (const node of Object.values(this.engine.nodes)) {
      if (this.isRealtimeOutputNode(node)) {
        ids.push(node.id);
      }
    }
    this.annotatedOutputNodeIds = ids;
  }

  private async resolveSocketValueForPreview(
    inputSocket: any
  ): Promise<number> {
    if (!this.engine) return 0;
    if (!inputSocket?.links || inputSocket.links.length === 0) return 0;

    const nodes = this.engine.nodes;

    // Safe because links.length > 0
    const upstreamLink = inputSocket.links[0]!;

    if (
      upstreamLink._targetNode === undefined ||
      upstreamLink._targetSocket === undefined
    ) {
      upstreamLink._targetNode = nodes[upstreamLink.nodeId]!;
      upstreamLink._targetSocket = upstreamLink._targetNode.outputs.find(
        (socket: any) => socket.name === upstreamLink.socketName
      );
      if (upstreamLink._targetSocket === undefined) {
        throw new Error(
          `can not find socket with the name ${upstreamLink.socketName}`
        );
      }
    }

    const upstreamNode = upstreamLink._targetNode;
    const upstreamOutputSocket = upstreamLink._targetSocket;

    // If upstream is a flow/event/async node, use its existing output value.
    if (!isFunctionNode(upstreamNode)) {
      inputSocket.value = upstreamOutputSocket.value;
      return 0;
    }

    let executionSteps = 0;
    for (const upstreamInputSocket of upstreamNode.inputs) {
      executionSteps +=
        await this.resolveSocketValueForPreview(upstreamInputSocket);
    }

    this.engine.onNodeExecutionStart.emit(upstreamNode);
    await upstreamNode.exec(upstreamNode);
    executionSteps++;
    this.engine.onNodeExecutionEnd.emit(upstreamNode);

    inputSocket.value = upstreamOutputSocket.value;
    return executionSteps;
  }

  private async recalculateAnnotatedOutputNodes(): Promise<void> {
    if (!this.engine) return;
    if (this.annotatedOutputNodeIds.length === 0) return;

    for (const nodeId of this.annotatedOutputNodeIds) {
      await this.evaluateNodeForPreview(nodeId);
    }
  }

  /**
   * Evaluate every node that a UI consumer is actively watching.
   *
   * Pure function graphs (e.g. the image nodes) never run during
   * `executeAllSync()` because nothing pushes a flow fiber through them. They
   * are normally pulled lazily when a downstream flow/event node reads their
   * value. In the editor preview there is no such consumer, so the act of a
   * component calling `watchNodeOutput()` is what drives evaluation: we resolve
   * the node's upstream function graph and execute the node itself so its
   * sockets hold a fresh value for `publishWatchedOutputs()` to read.
   *
   * This intentionally does not depend on the `ui.realtime` annotation , any
   * watched output is evaluated.
   */
  private async recalculateWatchedOutputs(): Promise<void> {
    if (!this.engine) return;
    if (this.watched.size === 0) return;

    for (const nodeId of this.watched.keys()) {
      await this.evaluateNodeForPreview(nodeId);
    }
  }

  /**
   * Resolve a single function node's inputs (recursively executing its upstream
   * function graph) and execute it. Non-function nodes keep whatever value their
   * last real execution produced. Resilient: a failure on one node is logged and
   * does not abort evaluation of the others.
   */
  private async evaluateNodeForPreview(nodeId: string): Promise<void> {
    if (!this.engine) return;
    const node = this.engine.nodes?.[nodeId];
    if (!node) return;
    if (!isFunctionNode(node)) return;

    try {
      let executionSteps = 0;
      for (const inputSocket of node.inputs) {
        executionSteps += await this.resolveSocketValueForPreview(inputSocket);
      }

      this.engine.onNodeExecutionStart.emit(node);
      await node.exec(node);
      executionSteps++;
      this.engine.onNodeExecutionEnd.emit(node);

      this.engine.executionSteps += executionSteps;
    } catch (err) {
      console.error(
        `RealtimeRunner: failed to evaluate watched node ${nodeId}:`,
        err
      );
    }
  }

  private rebuildEngine(): void {
    const specJson = this.system.specStore.getState().specs;
    if (!specJson || specJson.length === 0) return;

    const nodes = this.system.nodeStore.getState().nodes;
    const edges = this.system.edgeStore.getState().edges;

    const rawGraphJson = flowToBehave(
      this.system.session!,
      nodes,
      edges,
      specJson
    );
    const graphWithAnnotations = this.mergeNodeAnnotationsIntoMetadata(
      rawGraphJson,
      nodes
    );
    const graphJson = this.stripNonSemanticMetadata(graphWithAnnotations);

    const signature = this.computeGraphSignature(graphJson);
    if (this.lastGraphSignature === signature && this.engine) {
      return;
    }
    this.lastGraphSignature = signature;

    if (!this.executionRegistry) {
      return;
    }

    this.graphInstance = readGraphFromJSON({
      graphJson,
      registry: this.executionRegistry
    });

    if (this.engine) {
      this.engine.dispose();
    }

    this.engine = new Engine(this.graphInstance, this.executionRegistry);

    this.engine.onNodeExecutionError.addListener(({ error }) => {
      console.error(error);
    });

    this.store.getState().setEngine(this.engine);

    this.rebuildAnnotatedOutputNodeCache();
  }

  private publishWatchedOutputs(): void {
    if (!this.engine) return;
    if (this.watched.size === 0) return;

    const updates: Array<{
      nodeId: string;
      outputName: string;
      value: unknown;
    }> = [];

    for (const [nodeId, outputs] of this.watched.entries()) {
      const node = this.engine.nodes?.[nodeId];
      if (!node) continue;

      let lastForNode = this.lastPublished.get(nodeId);
      if (!lastForNode) {
        lastForNode = new Map<string, unknown>();
        this.lastPublished.set(nodeId, lastForNode);
      }

      for (const outputName of outputs.values()) {
        const outputSocket = node.outputs?.find(
          (s: any) => s.name === outputName
        );
        const inputSocket = outputSocket
          ? undefined
          : node.inputs?.find((s: any) => s.name === outputName);

        const value = (outputSocket ?? inputSocket)?.value;
        const prev = lastForNode.get(outputName);
        if (Object.is(prev, value)) continue;

        lastForNode.set(outputName, value);
        updates.push({ nodeId, outputName, value });
      }
    }

    if (updates.length > 0) {
      this.store.getState().setOutputs(updates);
    }
  }

  private async evaluate(): Promise<void> {
    try {
      this.rebuildEngine();
      if (!this.engine) return;

      // Compute function/flow nodes immediately.
      await this.engine.executeAllSync();

      // Recalculate annotated output nodes to force evaluation of upstream function graphs.
      await this.recalculateAnnotatedOutputNodes();

      // Pull every watched output (e.g. live image node previews) so pure
      // function graphs are evaluated even without a flow consumer.
      await this.recalculateWatchedOutputs();

      this.publishWatchedOutputs();
    } catch (err) {
      // Keep preview runner resilient; don't crash the editor.
      console.error('RealtimeRunner evaluate failed:', err);
    }
  }

  private async tick(): Promise<void> {
    if (!this.engine) return;
    if (this.watched.size === 0) return;

    try {
      const eventEmitter = this.executionRegistry?.dependencies
        ?.ILifecycleEventEmitter as ILifecycleEventEmitter | undefined;

      // Tick time-based graphs.
      eventEmitter?.tickEvent?.emit();

      await this.engine.executeAllSync();
      // Recalculate annotated output nodes to force evaluation of upstream function graphs.
      await this.recalculateAnnotatedOutputNodes();

      // Pull every watched output (e.g. live image node previews) so pure
      // function graphs are evaluated even without a flow consumer.
      await this.recalculateWatchedOutputs();

      this.publishWatchedOutputs();
    } catch {
      // ignore
    }
  }
}
