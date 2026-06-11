import { createStore } from 'zustand';
import type { GraphRunnerClient } from './client';
import type {
  AuthCredentials,
  GraphRunnerCapabilities,
  ServerVariable,
  ServerEvent,
  GraphRunnerMessage
} from './types';
import type { System } from '../../system';
import type { NodeSpecJSON } from '@kiberon-labs/behave-graph';
import type { StoreApi } from 'zustand';

export interface MessageActivity {
  id: string;
  timestamp: number;
  direction: 'sent' | 'received';
  message: GraphRunnerMessage;
}

export interface ConnectionConfig {
  url: string;
  auth: AuthCredentials;
  autoReconnect: boolean;
}

export interface ConnectionInfo {
  serverId: string | null;
  userId: string | null;
  sessionId: string | null;
  authenticated: boolean;
  capabilities: GraphRunnerCapabilities | null;
}

export interface GraphRunnerClientStore {
  // Connection state
  connectionState:
    | 'disconnected'
    | 'connecting'
    | 'authenticating'
    | 'connected';
  connectionConfig: ConnectionConfig;
  connectionInfo: ConnectionInfo;
  error: string | null;

  // Client instance
  client: GraphRunnerClient | null;

  // Server metadata
  serverVariables: ServerVariable[];
  serverEvents: ServerEvent[];
  nodeTypes: NodeSpecJSON[];

  // Message activity
  messageActivity: MessageActivity[];
  maxActivityMessages: number;

  // Execution state
  currentRunId: string | null;
  currentGraphId: string | null;
  isExecuting: boolean;
  isPaused: boolean;

  // Execution preferences
  clearLogsOnRun: boolean;
  clearTracesOnRun: boolean;
  enableTracing: boolean;

  // Actions
  setConnectionConfig: (config: Partial<ConnectionConfig>) => void;
  setClient: (client: GraphRunnerClient | null) => void;
  setConnectionState: (
    state: 'disconnected' | 'connecting' | 'authenticating' | 'connected'
  ) => void;
  setConnectionInfo: (info: Partial<ConnectionInfo>) => void;
  setError: (error: string | null) => void;
  setServerVariables: (variables: ServerVariable[]) => void;
  setServerEvents: (events: ServerEvent[]) => void;
  setNodeTypes: (nodeTypes: NodeSpecJSON[]) => void;
  clearServerMetadata: () => void;
  addMessageActivity: (
    direction: 'sent' | 'received',
    message: GraphRunnerMessage
  ) => void;
  clearMessageActivity: () => void;
  setCurrentRunId: (runId: string | null) => void;
  setCurrentGraphId: (graphId: string | null) => void;
  setIsExecuting: (isExecuting: boolean) => void;
  setIsPaused: (isPaused: boolean) => void;
  setClearLogsOnRun: (clear: boolean) => void;
  setClearTracesOnRun: (clear: boolean) => void;
  setEnableTracing: (enable: boolean) => void;
}

export const graphRunnerClientStoreFactory = (
  system: System
): StoreApi<GraphRunnerClientStore> => {
  return createStore<GraphRunnerClientStore>((set) => ({
    // Initial state
    connectionState: 'disconnected',
    connectionConfig: {
      url: '',
      auth: { type: 'none' },
      autoReconnect: true
    },
    connectionInfo: {
      serverId: null,
      userId: null,
      sessionId: null,
      authenticated: false,
      capabilities: null
    },
    error: null,
    client: null,
    serverVariables: [],
    serverEvents: [],
    nodeTypes: [],
    messageActivity: [],
    maxActivityMessages: 50,
    currentRunId: null,
    currentGraphId: null,
    isExecuting: false,
    isPaused: false,
    clearLogsOnRun: true,
    clearTracesOnRun: true,
    enableTracing: true,

    // Actions
    setConnectionConfig: (config) =>
      set((state) => ({
        connectionConfig: { ...state.connectionConfig, ...config }
      })),

    setClient: (client) => set({ client }),

    setConnectionState: (connectionState) => {
      set({ connectionState });
    },

    setConnectionInfo: (info) =>
      set((state) => ({
        connectionInfo: { ...state.connectionInfo, ...info }
      })),

    setError: (error) => set({ error }),

    setServerVariables: (serverVariables) => {
      set({ serverVariables });
      const variableStore = system.variableStore.getState();
      for (const serverVar of serverVariables) {
        variableStore.setVariable(serverVar.id, serverVar);
      }
    },

    setServerEvents: (serverEvents) => {
      set({ serverEvents });
      const eventStore = system.eventsStore.getState();
      for (const event of serverEvents) {
        eventStore.addCustomEvent(event);
      }
    },

    setNodeTypes: (nodeTypes) => {
      set({ nodeTypes });
      system.registry.getState().updateSpecs(nodeTypes);
    },

    clearServerMetadata: () =>
      set({
        serverVariables: [],
        serverEvents: [],
        nodeTypes: []
      }),

    addMessageActivity: (direction, message) =>
      set((state) => {
        const activity: MessageActivity = {
          id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          timestamp: Date.now(),
          direction,
          message
        };
        const newActivity = [activity, ...state.messageActivity].slice(
          0,
          state.maxActivityMessages
        );
        return { messageActivity: newActivity };
      }),

    clearMessageActivity: () => set({ messageActivity: [] }),

    setCurrentRunId: (currentRunId) => set({ currentRunId }),

    setCurrentGraphId: (currentGraphId) => set({ currentGraphId }),

    setIsExecuting: (isExecuting) => set({ isExecuting }),

    setIsPaused: (isPaused) => set({ isPaused }),

    setClearLogsOnRun: (clearLogsOnRun) => set({ clearLogsOnRun }),

    setClearTracesOnRun: (clearTracesOnRun) => set({ clearTracesOnRun }),

    setEnableTracing: (enableTracing) => set({ enableTracing })
  }));
};
