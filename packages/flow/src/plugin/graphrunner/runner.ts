import type { System } from '../../system/system';
import type { StoreApi } from 'zustand';
import type { GraphRunnerClientStore } from './store';
import { GraphRunnerClient } from './client';
import { buildUIGraphJSON } from '../../transformers/Uigraph';
import { setupClientEventListeners } from './actions';

declare module '@/system/system' {
  interface System {
    runner: GraphRunner;
  }
}

export class GraphRunner {
  private system: System;
  public readonly store: StoreApi<GraphRunnerClientStore>;

  constructor(system: System, store: StoreApi<GraphRunnerClientStore>) {
    this.system = system;
    this.store = store;
  }

  /**
   * Connect to the graph runner server
   */
  async connect(): Promise<void> {
    const {
      client,
      connectionConfig,
      setClient,
      setConnectionState,
      setConnectionInfo,
      setError,
      clearServerMetadata,
      addMessageActivity
    } = this.store.getState();

    try {
      setError(null);
      setConnectionState('connecting');

      const theClient =
        client ??
        new GraphRunnerClient({
          url: connectionConfig.url,
          auth: connectionConfig.auth,
          autoReconnect: connectionConfig.autoReconnect,
          onMessageActivity: (direction, message) => {
            addMessageActivity(direction, message);
          }
        });

      setClient(theClient);

      await theClient.connect();

      // Setup persistent event listeners for trace, logs, and run completion
      setupClientEventListeners(theClient, this.system, this.store);

      setConnectionState('connected');
      setConnectionInfo({
        serverId: theClient.getServerId(),
        userId: theClient.getUserId(),
        sessionId: null,
        authenticated: theClient.isAuthenticated(),
        capabilities: null
      });

      // Create session
      const sessionId = await theClient.createSession();
      setConnectionInfo({ sessionId });

      // Get capabilities
      const capabilities = await theClient.getCapabilities();
      setConnectionInfo({ capabilities });

      // Fetch metadata if supported
      if (capabilities.runtimeMetadata) {
        await this.refreshMetadata();
      }

      // Notify successful connection
      this.system.notifications.success(
        `Connected to ${theClient.getServerId() || 'graph runner server'}`
      );
    } catch (error) {
      setConnectionState('disconnected');
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setError(errorMessage);
      setClient(null);
      clearServerMetadata();

      // Notify connection error
      this.system.notifications.error(`Failed to connect: ${errorMessage}`);
    }
  }

  /**
   * Disconnect from the graph runner server
   */
  async disconnect(): Promise<void> {
    const {
      client,
      setClient,
      setConnectionState,
      setConnectionInfo,
      clearServerMetadata
    } = this.store.getState();

    console.log('Disconnecting from graph runner server...');
    if (client) {
      try {
        await client.closeSession();
        client.disconnect();
      } catch (error) {
        console.error('Error disconnecting:', error);
      }
    }

    setClient(null);
    setConnectionState('disconnected');
    setConnectionInfo({
      serverId: null,
      userId: null,
      sessionId: null,
      authenticated: false,
      capabilities: null
    });
    clearServerMetadata();
  }

  /**
   * Refresh server metadata (variables, events, node types)
   */
  async refreshMetadata(): Promise<void> {
    const {
      client,
      setServerVariables,
      setServerEvents,
      setNodeTypes,
      setError
    } = this.store.getState();
    if (!client) {
      return;
    }

    try {
      const capabilities = client.getCachedCapabilities();
      if (!capabilities?.runtimeMetadata) {
        return;
      }

      const [variables, events, nodeTypes] = await Promise.all([
        client.getServerVariables(),
        client.getServerEvents(),
        client.getNodeTypes()
      ]);

      setServerVariables(variables);
      setServerEvents(events);
      setNodeTypes(nodeTypes);

      setError(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Run a graph remotely
   */
  async runRemotely(
    graphId: string,
    options?: { graph?: unknown; inputs?: unknown }
  ): Promise<void> {
    const {
      client,
      setCurrentRunId,
      setCurrentGraphId,
      setIsExecuting,
      setIsPaused,
      isExecuting,
      enableTracing
    } = this.store.getState();

    if (!client) {
      this.system.notifications.error('No graph runner connection');
      throw new Error('No graph runner connection');
    }
    //already running
    if (isExecuting) {
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

      this.system.notifications.info(`Graph execution started: ${graphId}`);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      setIsPaused(false);
      this.system.notifications.error(`Failed to run graph: ${errorMessage}`);
      setIsExecuting(false);
      setCurrentRunId(null);
      setCurrentGraphId(null);
      throw error;
    }
  }

  /**
   * Stop the current graph execution
   */
  async stop(): Promise<void> {
    const {
      client,
      currentRunId,
      setIsExecuting,
      setCurrentRunId,
      setCurrentGraphId,
      setIsPaused
    } = this.store.getState();

    if (!client || !currentRunId) {
      return;
    }

    try {
      await client.stopGraph(currentRunId);
      this.system.notifications.info('Stopping graph execution');
      setIsExecuting(false);
      setCurrentRunId(null);
      setCurrentGraphId(null);
      setIsPaused(false);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.system.notifications.error(`Failed to stop graph: ${errorMessage}`);
    }
  }

  /**
   * Play the current graph
   */
  async play(): Promise<void> {
    const { clearLogsOnRun, clearTracesOnRun } = this.store.getState();

    // Clear logs if enabled
    if (clearLogsOnRun) {
      this.system.logsStore.getState().clear();
    }

    // Clear traces if enabled
    if (clearTracesOnRun) {
      this.system.traceStore.getState().clear();
    }

    const graphId = 'current';
    const uiGraphData = buildUIGraphJSON(this.system);
    const graphData = uiGraphData.flow;

    try {
      await this.runRemotely(graphId, { graph: graphData });
    } catch {
      // Error already handled in runRemotely
    }
  }

  /**
   * Pause the current graph execution
   */
  async pause(): Promise<void> {
    const { client, currentRunId, setIsPaused } = this.store.getState();

    if (!client || !currentRunId) {
      return;
    }

    try {
      // Check if the client's transport is LocalTransport with pause support
      const transport = (client as any).transport;
      if (transport && typeof transport.pauseExecution === 'function') {
        transport.pauseExecution(currentRunId);
        setIsPaused(true);
        this.system.notifications.info('Execution paused');
      } else {
        // Fallback to stop for remote transports
        await this.stop();
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.system.notifications.error(`Failed to pause graph: ${errorMessage}`);
    }
  }

  /**
   * Resume paused execution
   */
  async resume(): Promise<void> {
    const { client, currentRunId, setIsPaused } = this.store.getState();

    if (!client || !currentRunId) {
      return;
    }

    try {
      const transport = (client as any).transport;
      if (transport && typeof transport.resumeExecution === 'function') {
        setIsPaused(false);
        this.system.notifications.info('Resuming execution');
        await transport.resumeExecution(currentRunId);
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.system.notifications.error(
        `Failed to resume graph: ${errorMessage}`
      );
    }
  }

  /**
   * Execute one step forward
   */
  async step(): Promise<void> {
    const { client, currentRunId, setIsPaused } = this.store.getState();

    if (!client || !currentRunId) {
      return;
    }

    try {
      const transport = (client as any).transport;
      if (transport && typeof transport.stepExecution === 'function') {
        setIsPaused(true); // Ensure we stay paused after stepping
        await transport.stepExecution(currentRunId);
      } else {
        this.system.notifications.info(
          'Step execution not supported for this transport'
        );
      }
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      this.system.notifications.error(`Failed to step graph: ${errorMessage}`);
    }
  }
}
