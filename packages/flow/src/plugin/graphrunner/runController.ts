import { createStore, type StoreApi } from 'zustand';
import type { GraphSession } from '@/system/graphSession';
import type { GraphRunner } from './runner';
import { buildUIGraphJSON } from '../../transformers/Uigraph';
import { isBehaveNode } from '@/util/isBehaveNode';
import { supportsExecutionControl } from './transport';

// Contribute the per-session run controller to the graph session as a typed,
// plugin-owned property. Core no longer declares this field , the graph runner
// plugin attaches it via `session.decorate('runController', …)` from a session
// extension (see ./index.tsx).
declare module '@/system/graphSession' {
  interface IGraphSession {
    runController?: GraphRunController;
  }
}

/**
 * Per-run state for a single graph. Each {@link GraphSession} owns one of these,
 * so multiple graphs can run independently and concurrently.
 */
export interface RunControllerStore {
  currentRunId: string | null;
  currentGraphId: string | null;
  isExecuting: boolean;
  isPaused: boolean;
  setCurrentRunId: (runId: string | null) => void;
  setCurrentGraphId: (graphId: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
}

const runControllerStoreFactory = (): StoreApi<RunControllerStore> =>
  createStore<RunControllerStore>((set) => ({
    currentRunId: null,
    currentGraphId: null,
    isExecuting: false,
    isPaused: false,
    setCurrentRunId: (currentRunId) => set({ currentRunId }),
    setCurrentGraphId: (currentGraphId) => set({ currentGraphId }),
    setIsExecuting: (isExecuting) => set({ isExecuting }),
    setIsPaused: (isPaused) => set({ isPaused })
  }));

/**
 * Drives execution for a single graph session. Run lifecycle and run state are
 * per-session; the underlying connection/client is shared via {@link GraphRunner}.
 * Incoming server messages are routed back to the originating controller by run
 * id (see `GraphRunner.runIndex`).
 */
export class GraphRunController {
  public readonly session: GraphSession;
  public readonly runner: GraphRunner;
  public readonly store: StoreApi<RunControllerStore> =
    runControllerStoreFactory();
  private readonly disposers: Array<() => void> = [];

  constructor(session: GraphSession, runner: GraphRunner) {
    this.session = session;
    this.runner = runner;
    this.setupRealtimeForwarding();
  }

  private get notifications() {
    return this.session.editor.notifications;
  }

  /** Run the graph for this session. */
  async play(): Promise<void> {
    const { clearLogsOnRun, clearTracesOnRun } = this.runner.store.getState();

    if (clearLogsOnRun) {
      this.session.logsStore.getState().clear();
    }
    if (clearTracesOnRun) {
      this.session.traceStore.getState().clear();
    }

    const graphId = this.session.id;
    const uiGraphData = buildUIGraphJSON(this.session);
    try {
      await this.runRemotely(graphId, { graph: uiGraphData.flow });
    } catch {
      // Error already surfaced in runRemotely
    }
  }

  async runRemotely(
    graphId: string,
    options?: { graph?: unknown; inputs?: unknown }
  ): Promise<void> {
    const client = this.runner.store.getState().client;
    const { enableTracing } = this.runner.store.getState();
    const { setCurrentRunId, setCurrentGraphId, setIsExecuting, setIsPaused } =
      this.store.getState();

    if (!client) {
      this.notifications.error('No graph runner connection');
      throw new Error('No graph runner connection');
    }
    if (this.store.getState().isExecuting) {
      return;
    }

    try {
      const runId = await client.runGraph(graphId, {
        ...options,
        trace: enableTracing
      });

      setCurrentRunId(runId);
      setCurrentGraphId(graphId);
      setIsExecuting(true);
      setIsPaused(false);
      this.runner.registerRun(runId, this);

      this.notifications.info(`Graph execution started: ${graphId}`);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      setIsExecuting(false);
      setIsPaused(false);
      setCurrentRunId(null);
      setCurrentGraphId(null);
      this.notifications.error(`Failed to run graph: ${message}`);
      throw error;
    }
  }

  async stop(): Promise<void> {
    const client = this.runner.store.getState().client;
    const { currentRunId } = this.store.getState();
    if (!client || !currentRunId) return;

    try {
      await client.stopGraph(currentRunId);
      this.notifications.info('Stopping graph execution');
      this.finishRun();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notifications.error(`Failed to stop graph: ${message}`);
    }
  }

  async pause(): Promise<void> {
    const client = this.runner.store.getState().client;
    const { currentRunId, setIsPaused } = this.store.getState();
    if (!client || !currentRunId) return;

    try {
      const transport = client.transport;
      if (supportsExecutionControl(transport)) {
        transport.pauseExecution(currentRunId);
        setIsPaused(true);
        this.notifications.info('Execution paused');
      } else {
        await this.stop();
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notifications.error(`Failed to pause graph: ${message}`);
    }
  }

  async resume(): Promise<void> {
    const client = this.runner.store.getState().client;
    const { currentRunId, setIsPaused } = this.store.getState();
    if (!client || !currentRunId) return;

    try {
      const transport = client.transport;
      if (supportsExecutionControl(transport)) {
        setIsPaused(false);
        this.notifications.info('Resuming execution');
        await transport.resumeExecution(currentRunId);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notifications.error(`Failed to resume graph: ${message}`);
    }
  }

  async step(): Promise<void> {
    const client = this.runner.store.getState().client;
    const { currentRunId, setIsPaused } = this.store.getState();
    if (!client || !currentRunId) return;

    try {
      const transport = client.transport;
      if (supportsExecutionControl(transport)) {
        setIsPaused(true);
        await transport.stepExecution(currentRunId);
      } else {
        this.notifications.info(
          'Step execution not supported for this transport'
        );
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      this.notifications.error(`Failed to step graph: ${message}`);
    }
  }

  /** Reset run state after completion/stop/error and unregister the run. */
  finishRun(): void {
    const runId = this.store.getState().currentRunId;
    if (runId) this.runner.unregisterRun(runId);
    const s = this.store.getState();
    s.setIsExecuting(false);
    s.setIsPaused(false);
    s.setCurrentRunId(null);
    s.setCurrentGraphId(null);
  }

  /**
   * Forward live graph edits to the server while this graph is running, tagged
   * with this controller's run id so concurrent graphs stay isolated.
   */
  private setupRealtimeForwarding(): void {
    const pubsub = this.session.pubsub;
    const canForward = () => {
      const client = this.runner.store.getState().client;
      const runId = this.store.getState().currentRunId;
      const caps = this.runner.store.getState().connectionInfo.capabilities;
      return client && runId && caps?.realtime ? { client, runId } : null;
    };

    const tokens = [
      pubsub.subscribe('node:added', (_, node) => {
        if (!isBehaveNode(node)) return;
        const ctx = canForward();
        if (!ctx) return;
        ctx.client.addNode(
          ctx.runId,
          node.id,
          node.data.type,
          node.data as Record<string, unknown>,
          node.position
        );
      }),
      pubsub.subscribe('edge:added', (_, edge) => {
        const ctx = canForward();
        if (!ctx || !edge.source || !edge.target) return;
        ctx.client.createLink(
          ctx.runId,
          edge.source,
          edge.sourceHandle || '',
          edge.target,
          edge.targetHandle || ''
        );
      }),
      pubsub.subscribe('edge:removed', (_, edge) => {
        const ctx = canForward();
        if (!ctx || !edge.source || !edge.target) return;
        ctx.client.removeLink(
          ctx.runId,
          edge.source,
          edge.sourceHandle || '',
          edge.target,
          edge.targetHandle || ''
        );
      }),
      pubsub.subscribe('node:removed', (_, node) => {
        if (!isBehaveNode(node)) return;
        const ctx = canForward();
        if (!ctx) return;
        ctx.client.removeNode(ctx.runId, node.id);
      })
    ];

    for (const token of tokens) {
      if (typeof token === 'string') {
        this.disposers.push(() => pubsub.unsubscribe(token));
      }
    }
  }

  dispose(): void {
    const runId = this.store.getState().currentRunId;
    if (runId) this.runner.unregisterRun(runId);
    this.disposers.forEach((d) => d());
    this.disposers.length = 0;
  }
}
