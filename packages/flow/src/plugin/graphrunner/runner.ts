import type { System } from '../../system/system';
import type { StoreApi } from 'zustand';
import type { GraphRunnerClientStore } from './store';
import { GraphRunnerClient } from './client';
import { setupClientEventListeners } from './actions';
import type { GraphRunController } from './runController';

declare module '@/system/system' {
  interface System {
    runner: GraphRunner;
  }
}

/**
 * Shared connection to the graph runner server. Owns the client, connection
 * lifecycle and server metadata; per-graph run state and run lifecycle live on
 * {@link GraphRunController}. Incoming server messages are dispatched back to the
 * owning controller via {@link GraphRunner.runIndex}, keyed by run id, so
 * multiple graphs can run concurrently and independently.
 */
export class GraphRunner {
  private system: System;
  public readonly store: StoreApi<GraphRunnerClientStore>;
  /** runId -> the controller that started it. */
  public readonly runIndex = new Map<string, GraphRunController>();

  constructor(system: System, store: StoreApi<GraphRunnerClientStore>) {
    this.system = system;
    this.store = store;
  }

  registerRun(runId: string, controller: GraphRunController): void {
    this.runIndex.set(runId, controller);
  }

  unregisterRun(runId: string): void {
    this.runIndex.delete(runId);
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

      // Setup persistent event listeners for trace, logs, and run completion.
      // Messages are routed to the originating session by run id.
      setupClientEventListeners(theClient, this);

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
}
